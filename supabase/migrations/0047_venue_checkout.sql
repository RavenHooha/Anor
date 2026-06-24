-- Real venue check-out. Lets a user stop appearing at a venue even while still
-- physically there, and keeps them checked out until they actually leave —
-- instead of the next background ping silently re-confirming them.
--
-- Mechanism: a per-user opt-out (presence.venue_optout_id). While it points at
-- the venue you're standing in, presence_checkin refuses to re-confirm you
-- there. The moment you leave that venue's radius (or move to a different one),
-- the opt-out lifts on its own, so a later return checks you in normally.
--
-- checkout_venue() is the unified "go quiet here" action: it clears the auto
-- co-presence AND the manual venue label in one call.

alter table presence
  add column if not exists venue_optout_id uuid;

-- ── presence_checkin: honor the opt-out ─────────────────────────────────

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
  detected_v uuid;   -- nearest active venue within radius (where you physically are)
  v_name text;
  old_v uuid;
  old_since timestamptz;
  optout uuid;       -- venue the user explicitly checked out of
  rec_v uuid;        -- venue actually recorded (null while suppressed)
  new_since timestamptz;
  confirmed boolean;
  copresent int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select id, name into detected_v, v_name
  from venues
  where active and st_dwithin(location, pt, checkin_radius_m)
  order by st_distance(location, pt) asc
  limit 1;

  select presence.venue_id, presence.venue_since, presence.venue_optout_id
    into old_v, old_since, optout
  from presence
  where user_id = uid;

  -- Lift the opt-out as soon as you're not standing in the venue you left.
  if optout is not null and (detected_v is null or detected_v <> optout) then
    optout := null;
  end if;

  if detected_v is not null and detected_v = optout then
    -- Checked out and still here: stay invisible, keep the opt-out.
    rec_v := null;
    new_since := null;
    v_name := null;
  elsif detected_v is null then
    rec_v := null;
    new_since := null;
    v_name := null;
  elsif detected_v = old_v then
    rec_v := detected_v;
    new_since := coalesce(old_since, now());
  else
    rec_v := detected_v;
    new_since := now();
  end if;

  insert into presence (
    user_id, location, accuracy_m, venue_id, venue_since, venue_optout_id, updated_at
  )
  values (uid, pt, p_accuracy, rec_v, new_since, optout, now())
  on conflict (user_id) do update
    set location = excluded.location,
        accuracy_m = excluded.accuracy_m,
        venue_id = excluded.venue_id,
        venue_since = excluded.venue_since,
        venue_optout_id = excluded.venue_optout_id,
        updated_at = now();

  confirmed := (new_since is not null and new_since <= now() - dwell);

  if confirmed then
    select count(*) into copresent
    from presence pr
    where pr.venue_id = rec_v
      and pr.user_id <> uid
      and pr.venue_since is not null
      and pr.venue_since <= now() - dwell
      and pr.updated_at > now() - interval '5 minutes'
      and pr.status is not null
      and pr.status <> 'focus'
      and not is_blocked(uid, pr.user_id);
  end if;

  return query select rec_v, v_name, confirmed, copresent;
end $$;

revoke execute on function presence_checkin(double precision, double precision, int) from anon, public;
grant execute on function presence_checkin(double precision, double precision, int) to authenticated;

-- ── checkout_venue: unified "go quiet here" ─────────────────────────────

create or replace function checkout_venue()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  cur_venue uuid;
  opted_in boolean;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select venue_id into cur_venue from presence where user_id = uid;

  -- Close any open analytics check-in row (only if the user opted in).
  select analytics_opted_in into opted_in from profiles where id = uid;
  if coalesce(opted_in, false) then
    update venue_checkins
    set ended_at = now()
    where user_id = uid and ended_at is null;
  end if;

  -- Drop the auto co-presence AND the manual label; remember the venue so
  -- presence_checkin won't re-add us until we leave its radius.
  update presence
  set venue_id = null,
      venue_since = null,
      venue_optout_id = cur_venue,
      venue = null,
      venue_location = null
  where user_id = uid;
end $$;

revoke execute on function checkout_venue() from anon, public;
grant execute on function checkout_venue() to authenticated;
