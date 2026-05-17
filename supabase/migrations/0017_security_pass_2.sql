-- Security pass 2:
--   1. Per-user rate limits on blocks, reports, threads, messages (anti-spam)
--   2. audit_log table + triggers on block / report / account_delete
--   3. profiles.hide_message_preview (privacy on lock screen)
--   4. Push triggers respect hide_message_preview
--   5. delete_my_account RPC (legal: GDPR/CCPA right-to-be-forgotten)

-- ── 1. Rate limits ───────────────────────────────────────────────────

create or replace function rate_limit_blocks()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  c int;
begin
  select count(*) into c
  from blocks
  where blocker_id = new.blocker_id
    and created_at > now() - interval '1 hour';
  if c >= 50 then
    raise exception 'Too many blocks in the last hour. Try again later.';
  end if;
  return new;
end $$;

drop trigger if exists blocks_rate_limit on blocks;
create trigger blocks_rate_limit
  before insert on blocks
  for each row execute function rate_limit_blocks();

create or replace function rate_limit_reports()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  c int;
begin
  select count(*) into c
  from reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '1 hour';
  if c >= 5 then
    raise exception 'Too many reports in the last hour. Try again later.';
  end if;
  return new;
end $$;

drop trigger if exists reports_rate_limit on reports;
create trigger reports_rate_limit
  before insert on reports
  for each row execute function rate_limit_reports();

create or replace function rate_limit_messages()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  c int;
begin
  select count(*) into c
  from messages
  where from_user_id = new.from_user_id
    and created_at > now() - interval '1 hour';
  if c >= 60 then
    raise exception 'Too many messages in the last hour. Slow down.';
  end if;
  return new;
end $$;

drop trigger if exists messages_rate_limit on messages;
create trigger messages_rate_limit
  before insert on messages
  for each row execute function rate_limit_messages();

-- Rate-limit thread creation by checking inside the RPC itself
-- (threads can also be inserted indirectly via Postgres replication, but
-- the only client path is this RPC since direct INSERT has no RLS policy).
create or replace function create_or_get_thread(other_id uuid, opener text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  existing_id uuid;
  new_id uuid;
  recent_count int;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_id = me then
    raise exception 'Cannot create thread with yourself';
  end if;
  if is_blocked(me, other_id) then
    raise exception 'Cannot create thread with blocked user';
  end if;

  a := least(me, other_id);
  b := greatest(me, other_id);

  select id into existing_id from threads where user_a = a and user_b = b;
  if existing_id is not null then
    if opener is not null then
      update threads
      set opener_text = opener
      where id = existing_id
        and initiator_id = me
        and accepted_at is null
        and opener_text is null;
    end if;
    return existing_id;
  end if;

  -- New-thread rate limit (10/hour per initiator).
  select count(*) into recent_count
  from threads
  where initiator_id = me
    and created_at > now() - interval '1 hour';
  if recent_count >= 10 then
    raise exception 'Too many new conversations in the last hour. Try again later.';
  end if;

  insert into threads (user_a, user_b, initiator_id, opener_text)
  values (a, b, me, opener)
  returning id into new_id;

  return new_id;
end $$;

-- ── 2. Audit log ─────────────────────────────────────────────────────

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on audit_log (actor_id, created_at desc);
create index if not exists audit_log_action_idx on audit_log (action, created_at desc);

alter table audit_log enable row level security;
-- No policies for authenticated — service_role only access for review.

create or replace function audit_block()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into audit_log (actor_id, action, target_id)
  values (new.blocker_id, 'block', new.blocked_id);
  return new;
end $$;

drop trigger if exists blocks_audit on blocks;
create trigger blocks_audit
  after insert on blocks
  for each row execute function audit_block();

create or replace function audit_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into audit_log (actor_id, action, target_id, details)
  values (
    new.reporter_id,
    'report',
    new.reported_id,
    jsonb_build_object('reason', new.reason, 'has_notes', new.notes is not null)
  );
  return new;
end $$;

drop trigger if exists reports_audit on reports;
create trigger reports_audit
  after insert on reports
  for each row execute function audit_report();

-- ── 3. profiles.hide_message_preview ─────────────────────────────────

alter table profiles
  add column if not exists hide_message_preview boolean not null default false;

-- ── 4. Push triggers respect hide_message_preview ────────────────────

create or replace function notify_on_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  recipient_id uuid;
  sender_name text;
  hide_preview boolean;
  title_text text;
  body_text text;
  tok text;
begin
  select case when t.user_a = new.from_user_id then t.user_b else t.user_a end
  into recipient_id
  from threads t where t.id = new.thread_id;

  if recipient_id is null then return new; end if;
  if is_blocked(new.from_user_id, recipient_id) then return new; end if;

  select name into sender_name from profiles where id = new.from_user_id;
  select hide_message_preview into hide_preview from profiles where id = recipient_id;

  if hide_preview then
    title_text := 'Anor';
    body_text := 'You have a new message';
  else
    title_text := coalesce(sender_name, 'Anor');
    body_text := new.body;
  end if;

  for tok in select pt.token from push_tokens pt where pt.user_id = recipient_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', tok,
        'title', title_text,
        'body', body_text,
        'sound', 'default',
        'data', jsonb_build_object('threadId', new.thread_id::text, 'kind', 'message')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;

  return new;
end $$;

create or replace function notify_on_thread_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  recipient_id uuid;
  sender_name text;
  hide_preview boolean;
  title_text text;
  body_text text;
  tok text;
begin
  recipient_id := case when new.user_a = new.initiator_id then new.user_b else new.user_a end;

  if is_blocked(new.initiator_id, recipient_id) then return new; end if;

  select name into sender_name from profiles where id = new.initiator_id;
  select hide_message_preview into hide_preview from profiles where id = recipient_id;

  if hide_preview then
    title_text := 'Anor';
    body_text := 'Someone wants to connect';
  else
    title_text := coalesce(sender_name, 'Anor');
    body_text := case when new.opener_text is null then 'waved at you' else new.opener_text end;
  end if;

  for tok in select pt.token from push_tokens pt where pt.user_id = recipient_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', tok,
        'title', title_text,
        'body', body_text,
        'sound', 'default',
        'data', jsonb_build_object('threadId', new.id::text, 'kind', 'thread')
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end loop;

  return new;
end $$;

-- ── 5. delete_my_account RPC ─────────────────────────────────────────
-- Cascades through every FK on profiles (presence, threads, messages,
-- blocks, push_tokens, photos, interests_junction, venue_checkins, etc.).
-- Also deletes the auth.users row so a malicious actor can't sign back in
-- and re-occupy the same identity.

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into audit_log (actor_id, action, target_id)
  values (uid, 'account_deleted', uid);

  delete from profiles where id = uid;
  delete from auth.users where id = uid;
end $$;

revoke execute on function delete_my_account() from anon, public;
grant execute on function delete_my_account() to authenticated;
