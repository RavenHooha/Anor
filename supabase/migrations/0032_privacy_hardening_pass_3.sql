-- Privacy hardening pass 3. Two council follow-ups:
--
-- A. profiles SELECT was readable table-wide by any authenticated user,
--    exposing is_admin / analytics_opted_in / hide_message_preview on every
--    row. Lock SELECT to the owner; serve other users' SAFE public columns
--    through a SECURITY DEFINER RPC (get_public_profile). nearby() already
--    serves the feed via a definer RPC and is unaffected. The only client that
--    read another user's profile directly was threads.ts (chat partner
--    name/photo) — it now calls get_public_profile.
--
-- B. export_my_data() omitted not-yet-rolled-up venue check-ins and its note
--    implied they were already deleted. Add them and correct the note.

-- ── A. profiles: stop exposing privileged columns to everyone ────────

create or replace function get_public_profile(target_id uuid)
returns table (
  id uuid,
  name text,
  photo_url text,
  photos text[],
  bio text,
  age int,
  interests text[],
  connect_prefs text[],
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.age,
         p.interests, p.connect_prefs, p.created_at
  from profiles p
  where p.id = target_id;
$$;

revoke execute on function get_public_profile(uuid) from anon, public;
grant execute on function get_public_profile(uuid) to authenticated;

drop policy if exists "profiles readable by authed" on profiles;
create policy "profiles self-read" on profiles
  for select using (auth.uid() = id);

-- ── B. export_my_data: include un-rolled venue check-ins, fix the note ──

create or replace function export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'note', 'Anor practices data minimization. Below is everything we currently retain on you. Messages auto-delete after 90 days of thread inactivity. Venue check-ins are kept as raw rows only until the next monthly rollup, when they are collapsed into anonymous, non-personal aggregates and the raw rows deleted — any check-ins listed below have not yet been rolled up. Audit log entries are kept for 90 days.',
    'profile', (
      select to_jsonb(p) - 'id'
      from profiles p where id = uid
    ),
    'venue_checkins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'venue', venue_text,
        'started_at', started_at,
        'ended_at', ended_at
      ) order by started_at desc)
      from venue_checkins where user_id = uid
    ), '[]'::jsonb),
    'recent_threads', coalesce((
      select jsonb_agg(jsonb_build_object(
        'thread_id', t.id,
        'with_user_id', case when t.user_a = uid then t.user_b else t.user_a end,
        'with_user_name', case when t.user_a = uid then other_b.name else other_a.name end,
        'opened_at', t.last_message_at,
        'message_count', t.message_count,
        'messages', coalesce((
          select jsonb_agg(jsonb_build_object(
            'sent_at', m.created_at,
            'from_me', m.from_user_id = uid,
            'body', m.body
          ) order by m.created_at)
          from messages m
          where m.thread_id = t.id
        ), '[]'::jsonb)
      ))
      from threads t
      left join profiles other_a on other_a.id = t.user_a
      left join profiles other_b on other_b.id = t.user_b
      where (t.user_a = uid or t.user_b = uid)
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'blocked_user_id', blocked_id,
        'blocked_at', created_at
      ))
      from blocks where blocker_id = uid
    ), '[]'::jsonb),
    'reports_filed', coalesce((
      select jsonb_agg(jsonb_build_object(
        'filed_at', created_at,
        'reason', reason,
        'notes', notes,
        'reviewed', reviewed_at is not null
      ))
      from reports where reporter_id = uid
    ), '[]'::jsonb),
    'push_tokens', coalesce((
      select jsonb_agg(jsonb_build_object(
        'platform', platform,
        'registered_at', created_at
      ))
      from push_tokens where user_id = uid
    ), '[]'::jsonb)
  ) into result;

  return result;
end $$;

revoke execute on function export_my_data() from anon, public;
grant execute on function export_my_data() to authenticated;
