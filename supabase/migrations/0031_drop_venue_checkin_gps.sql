-- Privacy: stop persisting point-precision GPS in the venue_checkins log.
--
-- venue_checkins.start_location (0015) stored full-precision GPS on every
-- check-in "for future analytics" — but it is write-only: nothing reads it,
-- and the monthly rollup (rollup_venue_checkins, 0020) aggregates purely by
-- venue_text. venue_text already captures the place. PRIVACY.md rule 3 says
-- never store point-precision GPS in venue_checkins, and these rows persist up
-- to ~2 months before rollup — so this is a standing contract violation with
-- zero functional cost to remove.
--
-- Note: presence.venue_location is intentionally NOT touched. It is ephemeral,
-- self-only (presence SELECT is owner-only as of 0030), and exists solely so
-- the 150m auto-clear trigger can tell when you've left the venue. It is not
-- part of the persisted log.

alter table venue_checkins drop column if exists start_location;

-- Recreate set_venue minus the start_location insert (otherwise it references
-- a dropped column). Logic is unchanged except the check-in no longer records
-- coordinates — only who tagged what venue, and when.
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
  opted_in boolean;
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

  if current_venue is not distinct from trimmed then
    return;
  end if;

  select analytics_opted_in into opted_in from profiles where id = uid;

  -- Close any prior open checkin (only meaningful if the user has been logging)
  if coalesce(opted_in, false) then
    update venue_checkins
    set ended_at = now()
    where user_id = uid and ended_at is null;
  end if;

  -- current_location still drives presence.venue_location (ephemeral, used by
  -- the auto-clear trigger) — it is just no longer written to the log.
  update presence
  set venue = trimmed,
      venue_location = current_location
  where user_id = uid;

  -- Insert checkin only if venue stuck post-trigger AND user has opted in.
  if coalesce(opted_in, false) then
    insert into venue_checkins (user_id, venue_text)
    select uid, trimmed
    from presence
    where user_id = uid and venue is not null;
  end if;
end $$;
