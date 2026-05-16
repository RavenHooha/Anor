-- RPC for the blocked users management screen.

create or replace function list_my_blocks()
returns table (
  user_id uuid,
  name text,
  photo_url text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select b.blocked_id as user_id, p.name, p.photo_url, b.created_at as blocked_at
  from blocks b
  join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke execute on function list_my_blocks() from anon, public;
grant execute on function list_my_blocks() to authenticated;
