-- Email notification on new report, via Resend + pg_net.
--
-- SETUP REQUIRED before this does anything (one-time):
--   1. Store your Resend API key in Supabase Vault under the exact name
--      RESEND_API_KEY:
--        Dashboard → Project Settings → Vault → New secret
--        Name: RESEND_API_KEY   Value: <your Resend API key>
--   2. meetanor.com must be a verified sending domain in Resend (done when
--      you set up custom SMTP). Sending from reports@meetanor.com needs only
--      the domain verified — no mailbox has to exist.
--   3. pg_net must be enabled (handled by the create extension below).
--
-- Behaviour:
--   - Fires asynchronously (pg_net queues the request), so it never slows
--     down or blocks the report insert.
--   - Wrapped in an exception handler: if Vault has no key, or Resend errors,
--     the report still saves. A broken notifier must never stop a user from
--     filing a report.
--   - Reports with reason 'child_safety' get an [URGENT] subject so they
--     stand out for the 24-hour child-safety review commitment.

create extension if not exists pg_net;

create or replace function notify_new_report()
returns trigger
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  resend_key text;
  reporter_name text;
  reported_name text;
  subject text;
begin
  begin
    select decrypted_secret into resend_key
    from vault.decrypted_secrets
    where name = 'RESEND_API_KEY';

    if resend_key is null then
      return new; -- key not configured yet; skip silently
    end if;

    select name into reporter_name from profiles where id = new.reporter_id;
    select name into reported_name from profiles where id = new.reported_id;

    subject := case
      when new.reason = 'child_safety'
        then '[URGENT - CHILD SAFETY] New Anor report'
      else 'New Anor report: ' || new.reason
    end;

    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'Anor Reports <reports@meetanor.com>',
        'to', 'support@meetanor.com',
        'subject', subject,
        'html', format(
          '<h2>%s</h2>'
          '<p><strong>Reason:</strong> %s</p>'
          '<p><strong>Reported user:</strong> %s (%s)</p>'
          '<p><strong>Reporter:</strong> %s (%s)</p>'
          '<p><strong>Notes:</strong> %s</p>'
          '<p><strong>Context thread:</strong> %s</p>'
          '<p><strong>Report ID:</strong> %s</p>'
          '<hr><p>Review via the Supabase SQL Editor — see docs/moderation.md.</p>',
          subject,
          new.reason,
          coalesce(reported_name, '(unknown)'), new.reported_id,
          coalesce(reporter_name, '(unknown)'), new.reporter_id,
          coalesce(new.notes, '(none)'),
          coalesce(new.context_thread_id::text, '(none)'),
          new.id
        )
      )
    );
  exception when others then
    return new; -- never let a notification failure block a report
  end;
  return new;
end $$;

revoke execute on function notify_new_report() from anon, public, authenticated;

drop trigger if exists reports_notify_email on reports;
create trigger reports_notify_email
  after insert on reports
  for each row execute function notify_new_report();
