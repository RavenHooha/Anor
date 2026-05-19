-- Make bans actually durable against same-email re-entry.
--
-- Before this, admin_ban_user deleted the auth.users row, which freed the
-- email — the banned user could request a fresh magic link with the same
-- address and immediately re-register. Now: the ban records a SHA-256 hash
-- of the email in banned_emails, and a trigger on profile creation rejects
-- anyone whose email is in that list.
--
-- LIMITATION (be honest about it): this only blocks the SAME email. A
-- determined evader with a new email + VPN can still get back in. Stronger
-- prevention (device/IP fingerprinting) is a much larger, privacy-sensitive
-- effort and is intentionally out of scope here. This stops lazy re-signups,
-- which is the large majority.

-- ── Blocklist (hashes only, no plaintext PII) ───────────────────────
create table if not exists banned_emails (
  email_hash text primary key,
  reason text,
  banned_at timestamptz not null default now(),
  original_user_id uuid
);

alter table banned_emails enable row level security;
-- No policies: reachable only via the SECURITY DEFINER functions below.

-- SHA-256 of the normalized email. sha256() is built into Postgres 11+
-- (pg_catalog), so no pgcrypto extension is needed.
create or replace function hash_email(p_email text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(sha256(convert_to(lower(trim(p_email)), 'UTF8')), 'hex');
$$;

-- ── Ban now records the email hash before wiping the account ─────────
create or replace function admin_ban_user(p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email text;
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot ban yourself';
  end if;

  select email into v_email from auth.users where id = p_user_id;

  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_ban', p_user_id, jsonb_build_object('reason', p_reason));

  if v_email is not null then
    insert into banned_emails (email_hash, reason, original_user_id)
    values (hash_email(v_email), p_reason, p_user_id)
    on conflict (email_hash) do nothing;
  end if;

  delete from profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end $$;

revoke execute on function admin_ban_user(uuid, text) from anon, public;
grant execute on function admin_ban_user(uuid, text) to authenticated;

-- ── Block profile creation for banned emails ─────────────────────────
create or replace function block_banned_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = new.id;
  if v_email is not null
     and exists (select 1 from banned_emails b where b.email_hash = hash_email(v_email))
  then
    raise exception 'This account has been banned.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_block_banned on profiles;
create trigger profiles_block_banned
  before insert on profiles
  for each row execute function block_banned_profile_insert();

-- ── Optional: lift a ban ─────────────────────────────────────────────
-- If you ever need to un-ban an email (admin only). Pass the same email
-- that was banned; it re-hashes and removes the blocklist row.
create or replace function admin_unban_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  delete from banned_emails where email_hash = hash_email(p_email);
  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_unban_email', null, jsonb_build_object('email_hash', hash_email(p_email)));
end $$;

revoke execute on function admin_unban_email(text) from anon, public;
grant execute on function admin_unban_email(text) to authenticated;
