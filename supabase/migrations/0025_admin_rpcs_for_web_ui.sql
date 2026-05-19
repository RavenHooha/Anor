-- Admin web UI backend: an is_admin flag, a reusable is_admin() guard, and
-- admin-gated RPCs for both reading (triage) and writing (actions).
--
-- Security model: NO service_role in the browser. The admin signs in with
-- their normal Anor account; their JWT carries auth.uid(); each RPC checks
-- is_admin() server-side and raises if false. All functions are SECURITY
-- DEFINER (so they can read/modify regardless of RLS) but every one is
-- gated by the is_admin() check, and execute is granted only to
-- authenticated (anon stays blocked).
--
-- To make yourself an admin after running this:
--   update profiles set is_admin = true where id = '<your-user-id>';

-- ── Admin flag ───────────────────────────────────────────────────────
alter table profiles
  add column if not exists is_admin boolean not null default false;

-- ── Guard ────────────────────────────────────────────────────────────
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

revoke execute on function is_admin() from anon;
grant execute on function is_admin() to authenticated;

-- ── Read: list reports (pending first, newest first) ─────────────────
create or replace function admin_list_reports()
returns table (
  report_id uuid,
  created_at timestamptz,
  reason text,
  notes text,
  reporter_id uuid,
  reporter_name text,
  reported_id uuid,
  reported_name text,
  context_thread_id uuid,
  reviewed_at timestamptz,
  reviewer_notes text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  return query
  select
    r.id, r.created_at, r.reason, r.notes,
    r.reporter_id, reporter.name,
    r.reported_id, reported.name,
    r.context_thread_id, r.reviewed_at, r.reviewer_notes
  from reports r
  join profiles reporter on reporter.id = r.reporter_id
  join profiles reported on reported.id = r.reported_id
  order by (r.reviewed_at is null) desc, r.created_at desc
  limit 500;
end $$;

revoke execute on function admin_list_reports() from anon, public;
grant execute on function admin_list_reports() to authenticated;

-- ── Read: full user detail + activity stats ──────────────────────────
create or replace function admin_get_user(p_user_id uuid)
returns table (
  id uuid,
  name text,
  bio text,
  photo_url text,
  photos text[],
  joined_at timestamptz,
  is_admin boolean,
  messages_sent bigint,
  threads_initiated bigint,
  blocks_made bigint,
  times_blocked bigint,
  times_reported bigint,
  reports_filed bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  return query
  select
    p.id, p.name, p.bio, p.photo_url, p.photos, p.created_at, p.is_admin,
    (select count(*) from messages where from_user_id = p.id),
    (select count(*) from threads where initiator_id = p.id),
    (select count(*) from blocks where blocker_id = p.id),
    (select count(*) from blocks where blocked_id = p.id),
    (select count(*) from reports where reported_id = p.id),
    (select count(*) from reports where reporter_id = p.id)
  from profiles p
  where p.id = p_user_id;
end $$;

revoke execute on function admin_get_user(uuid) from anon, public;
grant execute on function admin_get_user(uuid) to authenticated;

-- ── Read: a user's recent messages (no recipients, for privacy) ──────
create or replace function admin_get_user_messages(p_user_id uuid)
returns table (created_at timestamptz, body text, thread_id uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  return query
  select m.created_at, m.body, m.thread_id
  from messages m
  where m.from_user_id = p_user_id
  order by m.created_at desc
  limit 50;
end $$;

revoke execute on function admin_get_user_messages(uuid) from anon, public;
grant execute on function admin_get_user_messages(uuid) to authenticated;

-- ── Read: messages in a thread (report context) ─────────────────────
create or replace function admin_get_thread_messages(p_thread_id uuid)
returns table (created_at timestamptz, from_user_id uuid, sender_name text, body text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
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

-- ── Write: re-grant existing admin RPCs to admin JWTs ────────────────
-- These already exist (migration 0018) but were service_role-only. Replace
-- them so they check is_admin() and stamp actor_id = auth.uid(), then grant
-- execute to authenticated. SECURITY DEFINER means the body still runs with
-- elevated privileges (e.g., deleting from auth.users) regardless of caller.

create or replace function admin_ban_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot ban yourself';
  end if;

  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_ban', p_user_id, jsonb_build_object('reason', p_reason));

  delete from profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end $$;

revoke execute on function admin_ban_user(uuid, text) from anon, public;
grant execute on function admin_ban_user(uuid, text) to authenticated;

create or replace function admin_takedown_photo(
  p_user_id uuid,
  p_photo_url text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  storage_path text;
  remaining text[];
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;

  storage_path := regexp_replace(p_photo_url, '^.*/profile-photos/', '');

  update profiles
  set photos = array_remove(photos, p_photo_url)
  where id = p_user_id
  returning photos into remaining;

  update profiles
  set photo_url = case
    when array_length(remaining, 1) > 0 then remaining[1]
    else null
  end
  where id = p_user_id
    and (photo_url = p_photo_url or photo_url is null);

  delete from storage.objects
  where bucket_id = 'profile-photos'
    and name = storage_path;

  insert into audit_log (actor_id, action, target_id, details)
  values (
    auth.uid(),
    'photo_takedown',
    p_user_id,
    jsonb_build_object('photo_url', p_photo_url, 'reason', p_reason)
  );
end $$;

revoke execute on function admin_takedown_photo(uuid, text, text) from anon, public;
grant execute on function admin_takedown_photo(uuid, text, text) to authenticated;

create or replace function admin_mark_reports_reviewed(
  p_report_ids uuid[],
  p_notes text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected int;
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  update reports
  set reviewed_at = now(), reviewer_notes = p_notes
  where id = any(p_report_ids) and reviewed_at is null;
  get diagnostics affected = row_count;
  return affected;
end $$;

revoke execute on function admin_mark_reports_reviewed(uuid[], text) from anon, public;
grant execute on function admin_mark_reports_reviewed(uuid[], text) to authenticated;
