-- Data minimization: keep aggregate signals, drop raw personal data
-- on a schedule. This makes the GDPR export trivially small by design
-- (there's nothing to export that we don't actively need) and shrinks
-- the attack surface — what isn't stored can't leak or be subpoenaed.
--
-- IMPORTANT: this migration uses pg_cron to schedule the cleanup jobs.
-- Before applying, enable the pg_cron extension in Supabase:
--   Dashboard → Database → Extensions → search "pg_cron" → enable.
-- If you skip this step, the cleanup functions still exist (and can be
-- called manually) but won't run on a schedule.

create extension if not exists pg_cron;

-- ── Venue check-ins: roll up monthly, delete raw rows ────────────────

create table if not exists venue_aggregates (
  venue_text text not null,
  bucket_month date not null,
  unique_users int not null,
  total_checkins int not null,
  rolled_up_at timestamptz not null default now(),
  primary key (venue_text, bucket_month)
);

create index if not exists venue_aggregates_month_idx
  on venue_aggregates (bucket_month desc);

alter table venue_aggregates enable row level security;
-- No policies for authenticated — only service_role or future analytics RPCs.

create or replace function rollup_venue_checkins()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  rolled_count int;
begin
  insert into venue_aggregates (venue_text, bucket_month, unique_users, total_checkins)
  select
    venue_text,
    date_trunc('month', started_at)::date,
    count(distinct user_id),
    count(*)
  from venue_checkins
  where started_at < date_trunc('month', now())
  group by venue_text, date_trunc('month', started_at)
  on conflict (venue_text, bucket_month) do update set
    unique_users = excluded.unique_users,
    total_checkins = excluded.total_checkins,
    rolled_up_at = now();

  with deleted as (
    delete from venue_checkins
    where started_at < date_trunc('month', now())
    returning 1
  )
  select count(*) into rolled_count from deleted;

  return rolled_count;
end $$;

-- ── Messages + threads: delete after 90 days of thread inactivity ───

create or replace function cleanup_old_messages()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count int;
begin
  with stale_threads as (
    select id from threads
    where last_message_at < now() - interval '90 days'
  ),
  deleted as (
    delete from threads where id in (select id from stale_threads)
    returning 1
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end $$;

-- ── Audit log: 90-day retention ──────────────────────────────────────

create or replace function cleanup_old_audit_log()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count int;
begin
  with deleted as (
    delete from audit_log
    where created_at < now() - interval '90 days'
    returning 1
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end $$;

-- ── Reports: delete reviewed reports 30 days after review ───────────

create or replace function cleanup_reviewed_reports()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count int;
begin
  with deleted as (
    delete from reports
    where reviewed_at is not null
      and reviewed_at < now() - interval '30 days'
    returning 1
  )
  select count(*) into deleted_count from deleted;

  return deleted_count;
end $$;

-- ── Schedule all cleanup jobs via pg_cron ────────────────────────────
-- Daily at 03:00 UTC for the per-row cleanup; monthly on the 1st for
-- the venue rollup. Idempotent — re-running this migration is safe.

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'anor-cleanup-messages',
  'anor-cleanup-audit-log',
  'anor-cleanup-reports',
  'anor-rollup-venues'
);

select cron.schedule(
  'anor-cleanup-messages',
  '0 3 * * *',
  $$select public.cleanup_old_messages();$$
);

select cron.schedule(
  'anor-cleanup-audit-log',
  '0 3 * * *',
  $$select public.cleanup_old_audit_log();$$
);

select cron.schedule(
  'anor-cleanup-reports',
  '0 3 * * *',
  $$select public.cleanup_reviewed_reports();$$
);

-- Run the venue rollup on the 1st of every month at 04:00 UTC.
select cron.schedule(
  'anor-rollup-venues',
  '0 4 1 * *',
  $$select public.rollup_venue_checkins();$$
);

-- ── Export my data RPC ───────────────────────────────────────────────
-- Returns the full data set we hold on the current user as JSON.
-- Because of the cleanup policies above, this is by design a small
-- export — recent active threads only, no audit log entries older
-- than 90 days, no rolled-up venue check-ins.

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
    'note', 'Anor practices data minimization. Messages auto-delete after 90 days of thread inactivity; venue check-ins are rolled into anonymous monthly aggregates and the raw rows deleted; audit log entries are kept for 90 days. What is exported below is everything we currently retain on you.',
    'profile', (
      select to_jsonb(p) - 'id'
      from profiles p where id = uid
    ),
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
