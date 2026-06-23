-- Privacy hardening pass 4. Two council follow-ups about the one remaining
-- raw-coordinate store, `presence.location`:
--
-- A. presence.location holds a full-precision GPS POINT, but nothing reads a fix
--    older than the ~5-minute serving window in nearby(). The 0020 data-min
--    cleanup never touched presence, so every user who ever enabled location
--    leaves their last raw fix in the table indefinitely — the lone standing
--    raw-coordinate store, against PRIVACY.md rule 3. Fix: a daily job that NULLs
--    location/accuracy_m on rows untouched for >1 day. The row itself stays
--    (status/venue are still meaningful); only the stale raw coordinates are
--    dropped. Zero functional cost — those fixes are never served anyway.
--
-- B. export_my_data() returned profile/venue_checkins/threads/blocks/reports/
--    push_tokens and claimed "everything we currently retain on you", but
--    omitted the single most sensitive datum — the user's own raw GPS in
--    presence. Add the caller's presence row to the export (GDPR Art.15/20).
--    Paired with (A), any coordinates shown are a fresh <=1-day fix.

-- ── A. presence: drop stale raw coordinates daily ───────────────────────

create or replace function cleanup_stale_presence_location()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cleaned_count int;
begin
  with cleaned as (
    update presence
    set location = null,
        accuracy_m = null
    where updated_at < now() - interval '1 day'
      and location is not null
    returning 1
  )
  select count(*) into cleaned_count from cleaned;

  return cleaned_count;
end $$;

-- Daily at 03:00 UTC, alongside the other 0020 cleanup jobs. Idempotent.
select cron.unschedule(jobid)
from cron.job
where jobname = 'anor-cleanup-presence-location';

select cron.schedule(
  'anor-cleanup-presence-location',
  '0 3 * * *',
  $$select public.cleanup_stale_presence_location();$$
);

-- ── B. export_my_data: include the caller's own presence row ─────────────

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
    'note', 'Anor practices data minimization. Below is everything we currently retain on you. Your last location fix (presence) is kept only while it is recent — raw coordinates are dropped automatically after one day, so a fix appears below only if you were active within the last day. Messages auto-delete after 90 days of thread inactivity. Venue check-ins are kept as raw rows only until the next monthly rollup, when they are collapsed into anonymous, non-personal aggregates and the raw rows deleted — any check-ins listed below have not yet been rolled up. Audit log entries are kept for 90 days.',
    'profile', (
      select to_jsonb(p) - 'id'
      from profiles p where id = uid
    ),
    'presence', (
      select jsonb_build_object(
        'status', pr.status,
        'location', st_astext(pr.location::geometry),
        'accuracy_m', pr.accuracy_m,
        'updated_at', pr.updated_at
      )
      from presence pr where pr.user_id = uid
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
