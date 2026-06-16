-- Closes two RLS gaps surfaced by the review council and confirmed against
-- 0001_initial.sql. Both are pre-launch landmines, not active breaches.
--
-- 1. profiles UPDATE had a USING clause but NO WITH CHECK, and is_admin (added
--    in 0025) lives on that same row — so any authenticated user could
--    `update profiles set is_admin = true where id = <their own id>` with the
--    anon key and self-promote to admin (which unlocks ban/delete and reading
--    anyone's messages). Fix: add the missing WITH CHECK, and guard is_admin /
--    created_at against client writes with a trigger. (RLS WITH CHECK can't
--    compare a new row against the OLD row, so a trigger is the correct tool
--    for column immutability.)
--
-- 2. presence had a table-wide SELECT for any authenticated user, exposing every
--    active user's full-precision GPS directly — bypassing the distance
--    bucketing in nearby() that the privacy design depends on. Fix: restrict
--    presence SELECT to the owner; everyone else's presence is served only
--    through nearby() (SECURITY DEFINER, which bypasses RLS). Verified no client
--    code reads another user's presence directly — only self (status, venue,
--    location all key on auth.uid()).

-- ── 1. profiles: lock down privileged columns ───────────────────────

-- Re-add the self-update policy WITH a WITH CHECK so an update can't reassign
-- the row to a different id.
drop policy if exists "profiles self-update" on profiles;
create policy "profiles self-update" on profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Pin is_admin (and created_at) against client modification. auth.uid() is NULL
-- for service_role and SQL-editor operations — including the documented is_admin
-- bootstrap in 0025 — so those still pass through; only authenticated end-users
-- are guarded. Covers INSERT too (a client-created profile is never admin),
-- closing the new-row vector as well as the update vector.
create or replace function public.guard_profile_privileged_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      if new.is_admin is distinct from old.is_admin then
        raise exception 'is_admin cannot be changed by the client';
      end if;
      new.created_at := old.created_at;
    elsif tg_op = 'INSERT' then
      new.is_admin := false;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on profiles;
create trigger profiles_guard_privileged
  before insert or update on profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ── 2. presence: stop direct GPS exposure ───────────────────────────

drop policy if exists "presence readable by authed" on presence;
create policy "presence self-read" on presence
  for select using (auth.uid() = user_id);
