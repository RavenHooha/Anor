-- Nearby alerts — the cold-start retention hook. When the feed is empty, a user
-- can ask to be pinged the moment someone open-to-connect shows up near them.
-- Turns the dead "no one nearby" moment into a reason to keep Anor installed.
--
-- Detection is a pg_cron scan (every few minutes) rather than a trigger: "X is
-- now near Y" has no single insert event, and the subscriber set is small. Fires
-- once per arm (one-shot), then deactivates — re-armable, never spammy. Reuses
-- the pg_net → Expo Push pattern from 0011.

create table if not exists nearby_alerts (
  user_id          uuid primary key references profiles(id) on delete cascade,
  location         geography(point) not null,
  radius_m         int not null default 1000 check (radius_m between 100 and 50000),
  active           boolean not null default true,
  last_notified_at timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists nearby_alerts_active_idx on nearby_alerts (active) where active;
create index if not exists nearby_alerts_location_idx on nearby_alerts using gist (location);

alter table nearby_alerts enable row level security;

-- Self-read only; all writes go through the security-definer RPCs below.
drop policy if exists "nearby_alerts self-read" on nearby_alerts;
create policy "nearby_alerts self-read" on nearby_alerts
  for select using (auth.uid() = user_id);

-- Arm/refresh the alert, anchored at the caller's current location.
create or replace function set_nearby_alert(
  p_lat double precision,
  p_lng double precision,
  p_radius int default 1000
)
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
  if p_radius < 100 or p_radius > 50000 then
    raise exception 'radius out of range';
  end if;

  insert into nearby_alerts (user_id, location, radius_m, active, last_notified_at, created_at)
  values (
    uid,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_radius, true, null, now()
  )
  on conflict (user_id) do update
    set location = excluded.location,
        radius_m = excluded.radius_m,
        active = true,
        last_notified_at = null,
        created_at = now();
end $$;

revoke execute on function set_nearby_alert(double precision, double precision, int) from anon, public;
grant execute on function set_nearby_alert(double precision, double precision, int) to authenticated;

create or replace function clear_nearby_alert()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from nearby_alerts where user_id = auth.uid();
end $$;

revoke execute on function clear_nearby_alert() from anon, public;
grant execute on function clear_nearby_alert() to authenticated;

create or replace function get_nearby_alert()
returns table (active boolean, radius_m int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select active, radius_m from nearby_alerts where user_id = auth.uid();
$$;

revoke execute on function get_nearby_alert() from anon, public;
grant execute on function get_nearby_alert() to authenticated;

-- Cron scan: for each armed alert, if someone open-to-connect now has fresh
-- presence within range, push once and disarm.
create or replace function check_nearby_alerts()
returns int
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  a record;
  others int;
  tok text;
  fired int := 0;
begin
  for a in
    select * from nearby_alerts
    where active
      and (last_notified_at is null or last_notified_at < now() - interval '3 hours')
  loop
    select count(*) into others
    from presence pr
    where pr.user_id <> a.user_id
      and pr.location is not null
      and pr.updated_at > now() - interval '5 minutes'
      and pr.status is not null
      and pr.status <> 'focus'
      and st_dwithin(pr.location, a.location, a.radius_m)
      and not is_blocked(a.user_id, pr.user_id)
      and not is_blocked(pr.user_id, a.user_id);

    if others > 0 then
      for tok in select token from push_tokens where user_id = a.user_id loop
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          body := jsonb_build_object(
            'to', tok,
            'title', 'Someone''s nearby on Anor',
            'body', case
              when others = 1 then 'A new face just showed up near you.'
              else others || ' people are around you right now.'
            end,
            'sound', 'default',
            'data', jsonb_build_object('kind', 'nearby')
          ),
          headers := '{"Content-Type": "application/json"}'::jsonb
        );
      end loop;
      update nearby_alerts
        set active = false, last_notified_at = now()
        where user_id = a.user_id;
      fired := fired + 1;
    end if;
  end loop;

  return fired;
end $$;

-- Schedule every 3 minutes (idempotent — unschedule any prior copy first).
select cron.unschedule(jobid) from cron.job where jobname = 'anor-nearby-alerts';
select cron.schedule(
  'anor-nearby-alerts',
  '*/3 * * * *',
  $$select public.check_nearby_alerts();$$
);
