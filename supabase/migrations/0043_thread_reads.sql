-- Per-user read tracking. "Unread" now covers replies inside accepted threads,
-- not just brand-new incoming waves — so the bell and per-conversation dots
-- reflect anything you haven't seen.

create table if not exists thread_reads (
  thread_id    uuid not null references threads(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table thread_reads enable row level security;

drop policy if exists "thread_reads self-read" on thread_reads;
create policy "thread_reads self-read" on thread_reads
  for select using (auth.uid() = user_id);
-- writes go through mark_thread_read (security definer) only.

create or replace function mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  -- Participants only.
  if not exists (
    select 1 from threads t
    where t.id = p_thread_id and (t.user_a = uid or t.user_b = uid)
  ) then
    return;
  end if;
  insert into thread_reads (thread_id, user_id, last_read_at)
  values (p_thread_id, uid, now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
end $$;

revoke execute on function mark_thread_read(uuid) from anon, public;
grant execute on function mark_thread_read(uuid) to authenticated;

-- Rebuild list_my_threads (from 0041) adding an `unread` flag. Return type
-- changes, so drop first.
drop function if exists list_my_threads();

create function list_my_threads()
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
  last_message_from uuid,
  unread boolean
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
    lm.from_user_id as last_message_from,
    case
      -- an incoming message I haven't seen
      when lm.from_user_id is not null
           and lm.from_user_id <> auth.uid()
           and (lr.last_read_at is null or t.last_message_at > lr.last_read_at)
        then true
      -- a brand-new incoming wave/opener (no messages yet) I've never opened
      when t.message_count = 0
           and t.initiator_id <> auth.uid()
           and lr.last_read_at is null
        then true
      else false
    end as unread
  from threads t
  join profiles p on p.id = case when t.user_a = auth.uid() then t.user_b else t.user_a end
  left join lateral (
    select body, from_user_id
    from messages
    where thread_id = t.id
    order by created_at desc
    limit 1
  ) lm on true
  left join thread_reads lr on lr.thread_id = t.id and lr.user_id = auth.uid()
  where (t.user_a = auth.uid() or t.user_b = auth.uid())
    and not (case when t.user_a = auth.uid() then t.hidden_a else t.hidden_b end)
  order by t.last_message_at desc;
$$;

revoke execute on function list_my_threads() from anon, public;
grant execute on function list_my_threads() to authenticated;
