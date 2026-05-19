-- Fix: migration 0023 added 'child_safety' to the reports.reason CHECK
-- constraint, but the report_user RPC (migration 0016) has its OWN hardcoded
-- reason allowlist that still rejected it with 'invalid reason' before the
-- insert ever reached the table. This updates the RPC to accept child_safety,
-- and re-asserts the constraint (idempotent) so running this migration alone
-- fully enables child-safety reports.

alter table reports drop constraint if exists reports_reason_check;
alter table reports add constraint reports_reason_check check (reason in (
  'inappropriate_content',
  'harassment',
  'child_safety',
  'spam',
  'fake_profile',
  'safety',
  'other'
));

create or replace function report_user(
  reported uuid,
  reason text,
  context_thread uuid default null,
  notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if uid = reported then
    raise exception 'cannot report yourself';
  end if;
  if reason not in (
    'inappropriate_content',
    'harassment',
    'child_safety',
    'spam',
    'fake_profile',
    'safety',
    'other'
  ) then
    raise exception 'invalid reason';
  end if;
  if notes is not null and length(notes) > 500 then
    raise exception 'notes too long';
  end if;

  insert into reports (reporter_id, reported_id, reason, context_thread_id, notes)
  values (uid, reported, reason, context_thread, notes)
  returning id into new_id;

  return new_id;
end $$;

revoke execute on function report_user(uuid, text, uuid, text) from anon, public;
grant execute on function report_user(uuid, text, uuid, text) to authenticated;
