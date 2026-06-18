-- Rate limiting on the abuse-prone actions: messaging, starting new
-- conversations, and reporting. Postgres-native — no Redis/extra infra.
--
-- Each is a BEFORE INSERT trigger that counts the user's recent rows in a
-- window and rejects over the limit. SECURITY DEFINER + pinned search_path so
-- the count is accurate regardless of RLS and can't be search_path-hijacked.
-- Limits are generous for real use and only bite spam / harassment-flooding /
-- report-bombing. Tune the numbers inline as the user base grows.
--
-- Coverage note: messages are inserted directly (client, RLS-gated); threads
-- and reports go through SECURITY DEFINER RPCs — a BEFORE INSERT trigger fires
-- on the actual insert in all three paths, so every route is covered. For
-- threads, the trigger only fires on a genuinely NEW conversation (the
-- get-or-create RPC doesn't insert when the thread already exists), so
-- re-opening an existing chat is never rate-limited.

-- Supporting indexes so each window-count is an index range scan, not a seq scan.
create index if not exists messages_from_user_created_idx
  on messages (from_user_id, created_at);
create index if not exists threads_initiator_created_idx
  on threads (initiator_id, created_at);
create index if not exists reports_reporter_created_idx
  on reports (reporter_id, created_at);

-- ── Messages: max 30 per 60 seconds per sender ───────────────────────
create or replace function rl_messages()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from messages
  where from_user_id = NEW.from_user_id
    and created_at > now() - interval '60 seconds';
  if cnt >= 30 then
    raise exception 'Slow down — you''re sending messages too fast. Try again in a moment.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_rl_messages on messages;
create trigger trg_rl_messages
  before insert on messages
  for each row execute function rl_messages();

-- ── New conversations: max 20 initiated per hour per user ────────────
create or replace function rl_threads()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from threads
  where initiator_id = NEW.initiator_id
    and created_at > now() - interval '1 hour';
  if cnt >= 20 then
    raise exception 'You''ve started a lot of new conversations recently. Try again later.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_rl_threads on threads;
create trigger trg_rl_threads
  before insert on threads
  for each row execute function rl_threads();

-- ── Reports: max 10 per hour per reporter (anti report-bombing) ──────
create or replace function rl_reports()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from reports
  where reporter_id = NEW.reporter_id
    and created_at > now() - interval '1 hour';
  if cnt >= 10 then
    raise exception 'You''ve submitted many reports recently. Please try again later.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

drop trigger if exists trg_rl_reports on reports;
create trigger trg_rl_reports
  before insert on reports
  for each row execute function rl_reports();
