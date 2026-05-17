-- Append-only log of venue check-ins for future analytics.
-- Captures who tagged what venue, when, where they were anchored,
-- and when the session ended (via clear, auto-clear, or new venue).
-- No analytics queries yet — just accumulating history.

create table venue_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  venue_text text not null,
  start_location geography(point, 4326),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index venue_checkins_user_started_idx
  on venue_checkins (user_id, started_at desc);
create index venue_checkins_venue_started_idx
  on venue_checkins (venue_text, started_at desc);
create index venue_checkins_open_idx
  on venue_checkins (user_id) where ended_at is null;

alter table venue_checkins enable row level security;

-- Users can read their own check-in history. Writes happen only via
-- security-definer RPCs (set_venue / clear_venue) and the auto-clear trigger.
create policy "venue_checkins self-read" on venue_checkins
  for select using (auth.uid() = user_id);

-- Backfill any presence rows that already have a venue tagged, so the
-- log starts in a consistent state (no-op if nobody has tagged yet).
insert into venue_checkins (user_id, venue_text, start_location, started_at)
select user_id, venue, venue_location, updated_at
from presence
where venue is not null;

-- ── Update auto-clear trigger to close open checkins ───────────────

create or replace function clear_venue_if_moved()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.venue_location is not null
     and new.location is not null
     and st_distance(new.location, new.venue_location) > 150 then
    update venue_checkins
    set ended_at = now()
    where user_id = new.user_id and ended_at is null;

    new.venue := null;
    new.venue_location := null;
  end if;
  return new;
end $$;

-- ── Update set_venue to log a new checkin ──────────────────────────

create or replace function set_venue(venue_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  trimmed text := trim(venue_text);
  current_venue text;
  current_location geography;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if trimmed is null or length(trimmed) = 0 then
    raise exception 'venue cannot be empty';
  end if;
  if length(trimmed) > 60 then
    raise exception 'venue too long';
  end if;

  select venue, location into current_venue, current_location
  from presence where user_id = uid;

  -- No-op if unchanged; avoids spurious checkin churn.
  if current_venue is not distinct from trimmed then
    return;
  end if;

  -- Close any prior open checkin first.
  update venue_checkins
  set ended_at = now()
  where user_id = uid and ended_at is null;

  -- Update presence. Trigger may auto-clear if a concurrent location
  -- update has moved us >150m from current_location.
  update presence
  set venue = trimmed,
      venue_location = current_location
  where user_id = uid;

  -- Insert new checkin only if venue actually stuck (trigger didn't null it).
  insert into venue_checkins (user_id, venue_text, start_location)
  select uid, trimmed, current_location
  from presence
  where user_id = uid and venue is not null;
end $$;

-- ── Update clear_venue to close the open checkin ───────────────────

create or replace function clear_venue()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update venue_checkins
  set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  update presence
  set venue = null, venue_location = null
  where user_id = auth.uid();
end $$;
