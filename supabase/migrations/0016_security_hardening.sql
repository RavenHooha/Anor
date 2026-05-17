-- Security hardening before broader testing:
--   1. Block-check create_or_get_thread (was: blocked user could spam empty thread rows)
--   2. Bucket distance_m in nearby() to defeat fine-grained triangulation
--   3. Reports table + report_user RPC (no abuse-report path existed)

-- ── 1. Block-check thread creation ───────────────────────────────────

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

  insert into threads (user_a, user_b, initiator_id, opener_text)
  values (a, b, me, opener)
  returning id into new_id;

  return new_id;
end $$;

-- ── 2. Distance bucketing in nearby() ────────────────────────────────
-- Rounds distance to privacy-preserving buckets. An attacker who keeps
-- moving and re-querying can still triangulate, but only to ~bucket size,
-- not GPS-accuracy. UX is unaffected — formatDistance() on the client
-- never needed sub-50m precision anyway.

drop function if exists nearby(geography, int);

create or replace function nearby(my_location geography, radius_m int)
returns table (
  id uuid,
  name text,
  photo_url text,
  photos text[],
  bio text,
  interests text[],
  age int,
  status text,
  venue text,
  distance_m float
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.interests, p.age,
         pr.status, pr.venue,
         case
           when st_distance(pr.location, my_location) < 250
             then round(st_distance(pr.location, my_location) / 50.0) * 50
           when st_distance(pr.location, my_location) < 2000
             then round(st_distance(pr.location, my_location) / 100.0) * 100
           when st_distance(pr.location, my_location) < 25000
             then round(st_distance(pr.location, my_location) / 500.0) * 500
           else round(st_distance(pr.location, my_location) / 1000.0) * 1000
         end as distance_m
  from profiles p
  join presence pr on pr.user_id = p.id
  where pr.location is not null
    and pr.updated_at > now() - interval '5 minutes'
    and st_dwithin(pr.location, my_location, radius_m)
    and p.id != auth.uid()
    and not is_blocked(auth.uid(), p.id)
  order by st_distance(pr.location, my_location) asc
  limit 100;
$$;

revoke execute on function nearby(geography, int) from anon, public;
grant execute on function nearby(geography, int) to authenticated;

-- ── 3. Reports table + RPC ───────────────────────────────────────────

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (reason in (
    'inappropriate_content', 'harassment', 'spam', 'fake_profile', 'safety', 'other'
  )),
  context_thread_id uuid references threads(id) on delete set null,
  notes text check (notes is null or length(notes) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_notes text,
  check (reporter_id != reported_id)
);

create index reports_reported_id_idx on reports (reported_id);
create index reports_unreviewed_idx on reports (created_at) where reviewed_at is null;

alter table reports enable row level security;

-- Reporter can read their own submissions (so the app can show "you reported X").
create policy "reports self-read" on reports
  for select using (auth.uid() = reporter_id);

-- No insert/update/delete policies — writes only via report_user RPC.

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
    'inappropriate_content', 'harassment', 'spam', 'fake_profile', 'safety', 'other'
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
