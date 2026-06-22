-- Venue co-presence: "who's HERE at my venue right now, open to connect?"
--
-- Detection is a ~4-minute geofence DWELL keyed on admin-seeded venues, so a
-- walk-by/drive-by never surfaces you — only settling in does. The dwell timer
-- is pure SQL: each background location ping records which seeded venue you're
-- inside (if any) and *when you entered it*; you're "confirmed" once that entry
-- is >= 4 minutes old. No fragile in-app timers — a stationary user's periodic
-- pings keep venue_since stable, and it only resets when you actually move to a
-- different venue or leave.
--
-- Privacy: granularity is the venue, never coordinates. Co-presence is mutual —
-- you see others only when you too are discoverable + dwelled + not in Focus.
-- presence GPS stays self-read-only (0030); everyone else is served through
-- these SECURITY DEFINER RPCs, same as nearby().

-- ── presence: venue dwell tracking ──────────────────────────────────────
alter table presence
  add column if not exists venue_id uuid references venues(id) on delete set null;

alter table presence
  add column if not exists venue_since timestamptz;

create index if not exists presence_venue_idx on presence (venue_id);

-- ── presence_checkin: write location + advance the dwell state ───────────
-- Returns the current seeded venue (if inside one) and whether the 4-min dwell
-- is confirmed, so the client can reflect "approaching" vs "checked in".
create or replace function presence_checkin(
  p_lat double precision,
  p_lng double precision,
  p_accuracy int default null
)
returns table (
  venue_id uuid,
  venue_name text,
  dwell_confirmed boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  pt geography := st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography;
  checkin_radius_m constant int := 75;
  dwell interval := interval '4 minutes';
  v_id uuid;
  v_name text;
  old_v uuid;
  old_since timestamptz;
  new_since timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Nearest seeded venue we're physically inside.
  select id, name into v_id, v_name
  from venues
  where active and st_dwithin(location, pt, checkin_radius_m)
  order by st_distance(location, pt) asc
  limit 1;

  -- Existing dwell state for continuity.
  select presence.venue_id, presence.venue_since into old_v, old_since
  from presence
  where user_id = uid;

  if v_id is null then
    new_since := null;                 -- not at any venue
  elsif v_id = old_v then
    new_since := coalesce(old_since, now());  -- same venue → keep the clock
  else
    new_since := now();                -- entered a new venue → reset the clock
  end if;

  insert into presence (user_id, location, accuracy_m, venue_id, venue_since, updated_at)
  values (uid, pt, p_accuracy, v_id, new_since, now())
  on conflict (user_id) do update
    set location = excluded.location,
        accuracy_m = excluded.accuracy_m,
        venue_id = excluded.venue_id,
        venue_since = excluded.venue_since,
        updated_at = now();

  return query select
    v_id,
    v_name,
    (new_since is not null and new_since <= now() - dwell);
end $$;

revoke execute on function presence_checkin(double precision, double precision, int) from anon, public;
grant execute on function presence_checkin(double precision, double precision, int) to authenticated;

-- ── venue_copresence: others confirmed at my venue, open to connect ──────
create or replace function venue_copresence()
returns table (
  id uuid,
  name text,
  photo_url text,
  photos text[],
  bio text,
  interests text[],
  connect_prefs text[],
  age int,
  status text,
  venue text,
  distance_m float,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select venue_id
    from presence
    where user_id = auth.uid()
      and venue_id is not null
      and venue_since <= now() - interval '4 minutes'
      and updated_at > now() - interval '5 minutes'
  )
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.interests,
         p.connect_prefs, p.age, pr.status, v.name as venue,
         0::float as distance_m,
         p.created_at
  from me
  join presence pr on pr.venue_id = me.venue_id
  join venues v on v.id = pr.venue_id
  join profiles p on p.id = pr.user_id
  where pr.user_id != auth.uid()
    and pr.venue_since <= now() - interval '4 minutes'
    and pr.updated_at > now() - interval '5 minutes'
    and pr.status is not null
    and pr.status <> 'focus'
    and not is_blocked(auth.uid(), p.id)
  order by pr.venue_since asc
  limit 100;
$$;

revoke execute on function venue_copresence() from anon, public;
grant execute on function venue_copresence() to authenticated;
