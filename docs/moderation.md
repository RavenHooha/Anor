# Anor moderation playbook

Until there's an admin UI, moderation runs through Supabase SQL Editor with
the **service_role** key (the only role that can read `audit_log`,
`reports.reviewer_notes`, or call the admin RPCs below).

All write actions are logged to `audit_log`. Read actions are not.

---

## Triage: review pending reports

```sql
-- All unreviewed reports, newest first, with reporter/reported context
select
  r.id           as report_id,
  r.created_at,
  r.reason,
  r.notes,
  reporter.name  as reporter_name,
  reporter.id    as reporter_id,
  reported.name  as reported_name,
  reported.id    as reported_id,
  r.context_thread_id
from reports r
join profiles reporter on reporter.id = r.reporter_id
join profiles reported on reported.id = r.reported_id
where r.reviewed_at is null
order by r.created_at desc;
```

If `context_thread_id` is set, pull the conversation context:

```sql
-- Last 30 messages in the reported thread
select m.created_at, p.name as sender, m.body
from messages m
join profiles p on p.id = m.from_user_id
where m.thread_id = '<thread_id>'
order by m.created_at desc
limit 30;
```

---

## Profile a user

```sql
-- Full profile + activity stats
select
  p.id, p.name, p.bio, p.created_at as joined_at,
  (select count(*) from messages where from_user_id = p.id) as messages_sent,
  (select count(*) from threads where initiator_id = p.id) as threads_initiated,
  (select count(*) from blocks where blocker_id = p.id) as blocks_made,
  (select count(*) from blocks where blocked_id = p.id) as times_blocked,
  (select count(*) from reports where reported_id = p.id) as times_reported,
  (select count(*) from reports where reporter_id = p.id) as reports_filed
from profiles p
where p.id = '<user_id>';
```

```sql
-- Reasons users have reported this person
select reason, count(*) as count, max(created_at) as latest
from reports
where reported_id = '<user_id>'
group by reason
order by count desc;
```

```sql
-- Recent messages (without showing recipients — privacy)
select created_at, length(body) as char_count, body
from messages
where from_user_id = '<user_id>'
order by created_at desc
limit 20;
```

---

## Take action

### Resolve a report (no action needed)

```sql
-- Mark single report reviewed
update reports
set reviewed_at = now(), reviewer_notes = 'No violation found'
where id = '<report_id>';

-- Or bulk
select admin_mark_reports_reviewed(
  array['<report_id_1>'::uuid, '<report_id_2>'::uuid],
  'Reviewed in batch — no action'
);
```

### Remove a specific photo (DMCA, NSFW, etc.)

```sql
-- 1. Look up the user's photo URLs
select photos from profiles where id = '<user_id>';

-- 2. Take it down (removes from array + nukes storage object + audit log)
select admin_takedown_photo(
  '<user_id>'::uuid,
  'https://<ref>.supabase.co/storage/v1/object/public/profile-photos/<user_id>/<file>',
  'Reason: <e.g. NSFW>'
);
```

### Ban a user

Permanently deletes their profile + every related row (cascade) AND removes
their `auth.users` entry so the same email can't sign back into a ghost account.

```sql
select admin_ban_user(
  '<user_id>'::uuid,
  'Reason: <e.g. repeated harassment after warning>'
);
```

After banning, resolve any open reports against them:

```sql
update reports
set reviewed_at = now(), reviewer_notes = 'User banned'
where reported_id = '<user_id>' and reviewed_at is null;
```

---

## Audit & investigation

```sql
-- Recent moderation actions (admin or system)
select created_at, action, actor_id, target_id, details
from audit_log
where action in ('admin_ban', 'photo_takedown', 'admin_unblock')
order by created_at desc
limit 100;
```

```sql
-- Full audit trail for a specific user (as actor OR target)
select created_at, action, actor_id, target_id, details
from audit_log
where actor_id = '<user_id>' or target_id = '<user_id>'
order by created_at desc;
```

```sql
-- Top reported users this week
select reported_id, count(*) as report_count,
       array_agg(distinct reason) as reasons
from reports
where created_at > now() - interval '7 days'
group by reported_id
having count(*) >= 3
order by report_count desc;
```

```sql
-- Block clusters (someone being widely blocked is a red flag)
select blocked_id, count(*) as block_count
from blocks
where created_at > now() - interval '30 days'
group by blocked_id
having count(*) >= 5
order by block_count desc;
```

---

## Notes

- Storage object deletion via `admin_takedown_photo` is best-effort — if
  the URL doesn't match the expected pattern the storage delete is a no-op
  but the profile array is still updated.
- `admin_ban_user` is irreversible. There's no undo. Prefer `admin_takedown_photo`
  + a stern warning DM (not implemented) before banning first-time offenders.
- All admin RPCs are `security definer` and `revoke`d from `authenticated` —
  you must be in SQL Editor with service_role to call them.
- The audit log has no automatic expiration. Truncate periodically if you
  want a retention window.
