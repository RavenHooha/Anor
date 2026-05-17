-- Admin moderation RPCs. Callable ONLY via service_role
-- (no GRANT to authenticated). Use from Supabase SQL Editor or an
-- admin-only edge function. See docs/moderation.md for the playbook.

-- ── Photo takedown ───────────────────────────────────────────────────
-- Removes a specific photo URL from a user's profile + nukes the
-- underlying storage object. If the removed photo was the main one,
-- the next photo in the array becomes main; if none remain, photo_url
-- goes null.

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
  -- Public URL format:
  -- https://<ref>.supabase.co/storage/v1/object/public/profile-photos/<user_id>/<file>
  storage_path := regexp_replace(p_photo_url, '^.*/profile-photos/', '');

  -- Remove from photos array
  update profiles
  set photos = array_remove(photos, p_photo_url)
  where id = p_user_id
  returning photos into remaining;

  -- If main photo was the removed one, pick a new main
  update profiles
  set photo_url = case
    when array_length(remaining, 1) > 0 then remaining[1]
    else null
  end
  where id = p_user_id
    and (photo_url = p_photo_url or photo_url is null);

  -- Delete the storage object (no-op if it doesn't exist)
  delete from storage.objects
  where bucket_id = 'profile-photos'
    and name = storage_path;

  insert into audit_log (actor_id, action, target_id, details)
  values (
    null,
    'photo_takedown',
    p_user_id,
    jsonb_build_object('photo_url', p_photo_url, 'reason', p_reason)
  );
end $$;

revoke execute on function admin_takedown_photo(uuid, text, text)
  from anon, public, authenticated;

-- ── Admin ban ────────────────────────────────────────────────────────
-- Same effect as delete_my_account but initiated by admin, with reason.
-- Use when delete_my_account isn't appropriate (the user wouldn't
-- delete themselves).

create or replace function admin_ban_user(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into audit_log (actor_id, action, target_id, details)
  values (null, 'admin_ban', p_user_id, jsonb_build_object('reason', p_reason));

  -- Cascades through all FK relationships on profiles
  delete from profiles where id = p_user_id;
  -- Remove auth row so they can't sign back in
  delete from auth.users where id = p_user_id;
end $$;

revoke execute on function admin_ban_user(uuid, text)
  from anon, public, authenticated;

-- ── Bulk-mark reports reviewed ───────────────────────────────────────

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
  update reports
  set reviewed_at = now(), reviewer_notes = p_notes
  where id = any(p_report_ids) and reviewed_at is null;
  get diagnostics affected = row_count;
  return affected;
end $$;

revoke execute on function admin_mark_reports_reviewed(uuid[], text)
  from anon, public, authenticated;
