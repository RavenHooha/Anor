-- Accountability: log every time a moderator views message content.
--
-- The privacy policy now promises "every time a moderator views message
-- content it is logged internally." This makes that true. We log the two
-- RPCs that expose actual message bodies (admin_get_user_messages and
-- admin_get_thread_messages). We deliberately do NOT log admin_get_user
-- (profile + stats, no message content) or admin_list_reports (queue
-- metadata) to keep the audit trail signal-rich rather than noisy.
--
-- These were STABLE in migration 0025; adding an INSERT makes them VOLATILE
-- (a stable function can't write), so the STABLE marker is removed.

create or replace function admin_get_user_messages(p_user_id uuid)
returns table (created_at timestamptz, body text, thread_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_view_user_messages', p_user_id, null);
  return query
  select m.created_at, m.body, m.thread_id
  from messages m
  where m.from_user_id = p_user_id
  order by m.created_at desc
  limit 50;
end $$;

revoke execute on function admin_get_user_messages(uuid) from anon, public;
grant execute on function admin_get_user_messages(uuid) to authenticated;

create or replace function admin_get_thread_messages(p_thread_id uuid)
returns table (created_at timestamptz, from_user_id uuid, sender_name text, body text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_view_thread', null, jsonb_build_object('thread_id', p_thread_id));
  return query
  select m.created_at, m.from_user_id, p.name, m.body
  from messages m
  join profiles p on p.id = m.from_user_id
  where m.thread_id = p_thread_id
  order by m.created_at asc
  limit 100;
end $$;

revoke execute on function admin_get_thread_messages(uuid) from anon, public;
grant execute on function admin_get_thread_messages(uuid) to authenticated;
