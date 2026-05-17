-- Free-text venue field on presence (e.g. "Blue Bottle Coffee").
-- Auto-clears server-side when the user moves >150m from where they tagged it.

alter table presence
  add column if not exists venue text check (venue is null or length(venue) between 1 and 60);

alter table presence
  add column if not exists venue_location geography(point, 4326);

-- Trigger: any time presence.location changes, if the new location is >150m
-- from where the venue was tagged, clear venue + venue_location.
-- Fires BEFORE so we can mutate NEW in-place without re-update.
create or replace function clear_venue_if_moved()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.venue_location is not null
     and new.location is not null
     and st_distance(new.location, new.venue_location) > 150 then
    new.venue := null;
    new.venue_location := null;
  end if;
  return new;
end $$;

drop trigger if exists presence_clear_venue_if_moved on presence;
create trigger presence_clear_venue_if_moved
  before insert or update on presence
  for each row execute function clear_venue_if_moved();

-- RPC: set venue, snapshotting the user's current location as the anchor.
-- No location passed in — we use whatever is already in presence to avoid
-- a stale-coords race between client + server.
create or replace function set_venue(venue_text text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if venue_text is null or length(trim(venue_text)) = 0 then
    raise exception 'venue cannot be empty';
  end if;
  if length(venue_text) > 60 then
    raise exception 'venue too long';
  end if;

  update presence
  set venue = trim(venue_text),
      venue_location = location
  where user_id = uid;
end $$;

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
  update presence
  set venue = null, venue_location = null
  where user_id = auth.uid();
end $$;

revoke execute on function set_venue(text) from anon, public;
revoke execute on function clear_venue() from anon, public;
grant execute on function set_venue(text) to authenticated;
grant execute on function clear_venue() to authenticated;

-- Update nearby() to surface venue. Drop required because return type changes.
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
         st_distance(pr.location, my_location) as distance_m
  from profiles p
  join presence pr on pr.user_id = p.id
  where pr.location is not null
    and pr.updated_at > now() - interval '5 minutes'
    and st_dwithin(pr.location, my_location, radius_m)
    and p.id != auth.uid()
    and not is_blocked(auth.uid(), p.id)
  order by distance_m asc
  limit 100;
$$;

revoke execute on function nearby(geography, int) from anon, public;
grant execute on function nearby(geography, int) to authenticated;
