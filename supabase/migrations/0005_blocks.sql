-- Blocks: one user blocks another. Blocks are mutual in effect — neither
-- party sees the other in nearby/threads, and neither can send messages.

create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id != blocked_id)
);

create index blocks_blocked_id_idx on blocks (blocked_id);

alter table blocks enable row level security;

create policy "blocks readable by blocker" on blocks
  for select using (auth.uid() = blocker_id);

create policy "blocks self-insert" on blocks
  for insert with check (auth.uid() = blocker_id);

create policy "blocks self-delete" on blocks
  for delete using (auth.uid() = blocker_id);

-- Helper: is there a block in either direction between u1 and u2?
create or replace function is_blocked(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = u1 and blocked_id = u2)
       or (blocker_id = u2 and blocked_id = u1)
  );
$$;

revoke execute on function is_blocked(uuid, uuid) from anon, public;
grant execute on function is_blocked(uuid, uuid) to authenticated;

-- Exclude blocked pairs from nearby.
create or replace function nearby(my_location geography, radius_m int)
returns table (
  id uuid,
  name text,
  photo_url text,
  bio text,
  status text,
  distance_m float
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.photo_url, p.bio, pr.status,
         st_distance(pr.location, my_location) as distance_m
  from profiles p
  join presence pr on pr.user_id = p.id
  where pr.location is not null
    and pr.updated_at > now() - interval '5 minutes'
    and st_dwithin(pr.location, my_location, radius_m)
    and p.id != auth.uid()
    and not is_blocked(auth.uid(), p.id)
  order by distance_m asc
  limit 100;
$$;

-- Exclude blocked pairs from threads list.
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
  where (t.user_a = auth.uid() or t.user_b = auth.uid())
    and not is_blocked(t.user_a, t.user_b)
  order by t.last_message_at desc;
$$;

-- Reject message inserts where a block exists in either direction.
drop policy if exists "messages insert by participants" on messages;
create policy "messages insert by participants" on messages
  for insert with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from threads t
      where t.id = messages.thread_id
        and (auth.uid() = t.user_a or auth.uid() = t.user_b)
        and (t.accepted_at is not null or t.initiator_id != auth.uid())
        and not is_blocked(t.user_a, t.user_b)
    )
  );
