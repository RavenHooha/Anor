-- Support the check-in notification ("N people here are open to connect") and
-- the home-screen "Checked in at {venue}" indicator.
--
-- 1. presence_checkin also returns copresent_count — how many OTHERS are
--    confirmed at the same venue right now (same filters as venue_copresence),
--    so the background task can decide whether a check-in is worth a nudge
--    without a second round trip.
-- 2. my_checkin() — the caller's own current venue + whether dwell is confirmed,
--    so the UI can swap "Add a place" for "Checked in at {venue}".

-- Return type changes, so drop first.
drop function if exists presence_checkin(double precision, double precision, int);

create function presence_checkin(
  p_lat double precision,
  p_lng double precision,
  p_accuracy int default null
)
returns table (
  venue_id uuid,
  venue_name text,
  dwell_confirmed boolean,
  copresent_count int
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
  confirmed boolean;
  copresent int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id, name into v_id, v_name
  from venues
  where active and st_dwithin(location, pt, checkin_radius_m)
  order by st_distance(location, pt) asc
  limit 1;

  select presence.venue_id, presence.venue_since into old_v, old_since
  from presence
  where user_id = uid;

  if v_id is null then
    new_since := null;
  elsif v_id = old_v then
    new_since := coalesce(old_since, now());
  else
    new_since := now();
  end if;

  insert into presence (user_id, location, accuracy_m, venue_id, venue_since, updated_at)
  values (uid, pt, p_accuracy, v_id, new_since, now())
  on conflict (user_id) do update
    set location = excluded.location,
        accuracy_m = excluded.accuracy_m,
        venue_id = excluded.venue_id,
        venue_since = excluded.venue_since,
        updated_at = now();

  confirmed := (new_since is not null and new_since <= now() - dwell);

  if confirmed then
    select count(*) into copresent
    from presence pr
    where pr.venue_id = v_id
      and pr.user_id <> uid
      and pr.venue_since is not null
      and pr.venue_since <= now() - dwell
      and pr.updated_at > now() - interval '5 minutes'
      and pr.status is not null
      and pr.status <> 'focus'
      and not is_blocked(uid, pr.user_id);
  end if;

  return query select v_id, v_name, confirmed, copresent;
end $$;

revoke execute on function presence_checkin(double precision, double precision, int) from anon, public;
grant execute on function presence_checkin(double precision, double precision, int) to authenticated;

-- My own current venue + dwell state.
create or replace function my_checkin()
returns table (
  venue_id uuid,
  venue_name text,
  dwell_confirmed boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    pr.venue_id,
    v.name,
    (pr.venue_id is not null
       and pr.venue_since is not null
       and pr.venue_since <= now() - interval '4 minutes'
       and pr.updated_at > now() - interval '5 minutes') as dwell_confirmed
  from presence pr
  left join venues v on v.id = pr.venue_id
  where pr.user_id = auth.uid();
$$;

revoke execute on function my_checkin() from anon, public;
grant execute on function my_checkin() to authenticated;
