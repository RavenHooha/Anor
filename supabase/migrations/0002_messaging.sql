-- Ember messaging: threads, messages, RLS, triggers, hard message cap.
-- Apply via Supabase SQL Editor. Then enable realtime on the messages table:
--   Database → Replication → toggle `messages` on for `supabase_realtime` publication.
-- Or via SQL: `alter publication supabase_realtime add table messages;`

-- One thread per unordered pair of users.
-- user_a and user_b stored sorted (user_a < user_b) so the unique constraint covers both directions.
create table threads (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  initiator_id uuid not null references profiles(id) on delete cascade,
  opener_text text check (opener_text is null or char_length(opener_text) <= 120),
  accepted_at timestamptz,
  last_message_at timestamptz not null default now(),
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b),
  check (initiator_id = user_a or initiator_id = user_b)
);

create index threads_user_a_idx on threads (user_a, last_message_at desc);
create index threads_user_b_idx on threads (user_b, last_message_at desc);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  from_user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) > 0 and char_length(body) <= 500),
  created_at timestamptz not null default now()
);

create index messages_thread_id_idx on messages (thread_id, created_at);

-- ── Triggers ────────────────────────────────────────────────────────

-- Enforce 100-message hard cap per thread.
create or replace function enforce_message_cap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare current_count int;
begin
  select message_count into current_count from threads where id = new.thread_id;
  if current_count >= 100 then
    raise exception 'Thread is full (100 message limit reached)';
  end if;
  return new;
end $$;

create trigger messages_enforce_cap
  before insert on messages
  for each row execute function enforce_message_cap();

-- On message insert: increment count, bump last_message_at,
-- and accept the thread if the responder is sending their first message.
create or replace function on_message_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update threads
  set
    message_count = message_count + 1,
    last_message_at = now(),
    accepted_at = case
      when accepted_at is null and new.from_user_id != initiator_id then now()
      else accepted_at
    end
  where id = new.thread_id;
  return new;
end $$;

create trigger messages_update_thread
  after insert on messages
  for each row execute function on_message_insert();

-- ── Row Level Security ──────────────────────────────────────────────

alter table threads enable row level security;
alter table messages enable row level security;

-- THREADS: participants can read; initiator inserts (with self as initiator and a participant);
-- only the trigger updates threads, so no user-facing UPDATE policy is needed.
create policy "threads readable by participants" on threads
  for select using (auth.uid() = user_a or auth.uid() = user_b);

create policy "threads insert by initiator" on threads
  for insert with check (
    auth.uid() = initiator_id
    and (auth.uid() = user_a or auth.uid() = user_b)
  );

-- MESSAGES: participants can read; participants can insert if either the thread is
-- accepted (anyone can send) or the thread is pending and they are NOT the initiator
-- (the recipient sending = acceptance). Cap enforced separately by trigger.
create policy "messages readable by participants" on messages
  for select using (
    exists (
      select 1 from threads t
      where t.id = messages.thread_id
        and (auth.uid() = t.user_a or auth.uid() = t.user_b)
    )
  );

create policy "messages insert by participants" on messages
  for insert with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from threads t
      where t.id = messages.thread_id
        and (auth.uid() = t.user_a or auth.uid() = t.user_b)
        and (t.accepted_at is not null or t.initiator_id != auth.uid())
    )
  );

-- ── RPCs ────────────────────────────────────────────────────────────

-- Atomically create a thread between the caller and other_id, or return the
-- existing one's id. Sorts the pair canonically. opener is the optional
-- opener_text (null = pure wave).
create or replace function create_or_get_thread(other_id uuid, opener text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  existing_id uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_id = me then
    raise exception 'Cannot create thread with yourself';
  end if;

  a := least(me, other_id);
  b := greatest(me, other_id);

  select id into existing_id from threads where user_a = a and user_b = b;
  if existing_id is not null then
    -- Upgrade a pending wave to an opener if caller is initiator and now providing text.
    if opener is not null then
      update threads
      set opener_text = opener
      where id = existing_id
        and initiator_id = me
        and accepted_at is null
        and opener_text is null;
    end if;
    return existing_id;
  end if;

  insert into threads (user_a, user_b, initiator_id, opener_text)
  values (a, b, me, opener)
  returning id into new_id;

  return new_id;
end $$;

revoke execute on function create_or_get_thread(uuid, text) from anon, public;
grant execute on function create_or_get_thread(uuid, text) to authenticated;

-- List the caller's threads with the other participant's profile and last message.
create or replace function list_my_threads()
returns table (
  thread_id uuid,
  other_id uuid,
  other_name text,
  other_photo_url text,
  initiator_id uuid,
  opener_text text,
  accepted_at timestamptz,
  last_message_at timestamptz,
  message_count int,
  last_message_body text,
  last_message_from uuid
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    t.id as thread_id,
    case when t.user_a = auth.uid() then t.user_b else t.user_a end as other_id,
    p.name as other_name,
    p.photo_url as other_photo_url,
    t.initiator_id,
    t.opener_text,
    t.accepted_at,
    t.last_message_at,
    t.message_count,
    lm.body as last_message_body,
    lm.from_user_id as last_message_from
  from threads t
  join profiles p on p.id = case when t.user_a = auth.uid() then t.user_b else t.user_a end
  left join lateral (
    select body, from_user_id
    from messages
    where thread_id = t.id
    order by created_at desc
    limit 1
  ) lm on true
  where t.user_a = auth.uid() or t.user_b = auth.uid()
  order by t.last_message_at desc;
$$;

revoke execute on function list_my_threads() from anon, public;
grant execute on function list_my_threads() to authenticated;

-- ── Realtime ────────────────────────────────────────────────────────
-- Enable Realtime publication for messages so live chat updates work.
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table threads;
