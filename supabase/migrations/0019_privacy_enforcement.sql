-- Privacy contract enforcement (write-time half).
-- See PRIVACY.md for the architectural contract and design decisions.
--
-- Default stance: opt-OUT. Users must explicitly enable analytics
-- participation. This dramatically reduces dataset size (probably 10-20%
-- of users will opt in without a perk) but is the most defensible stance
-- legally (GDPR/CCPA freely-given-consent) and ethically.
--
-- A future product question: what's the perk for opting in? Founding-member
-- badge, premium-boost credit, early-access feature flag — TBD.

-- ── Opt-in column ────────────────────────────────────────────────────

alter table profiles
  add column if not exists analytics_opted_in boolean not null default false;

-- ── Write-time enforcement: only log venue_checkins for opted-in users

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

  -- Close any prior open checkin (only meaningful if user has been
  -- logging — opted-out users have no open checkins to close)
  if coalesce(opted_in, false) then
    update venue_checkins
    set ended_at = now()
    where user_id = uid and ended_at is null;
  end if;

  update presence
  set venue = trimmed,
      venue_location = current_location
  where user_id = uid;

  -- Insert checkin only if venue stuck post-trigger AND user has opted in
  if coalesce(opted_in, false) then
    insert into venue_checkins (user_id, venue_text, start_location)
    select uid, trimmed, current_location
    from presence
    where user_id = uid and venue is not null;
  end if;
end $$;

create or replace function clear_venue()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  opted_in boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select analytics_opted_in into opted_in from profiles where id = auth.uid();
  if coalesce(opted_in, false) then
    update venue_checkins
    set ended_at = now()
    where user_id = auth.uid() and ended_at is null;
  end if;

  update presence
  set venue = null, venue_location = null
  where user_id = auth.uid();
end $$;

create or replace function clear_venue_if_moved()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  opted_in boolean;
begin
  if new.venue_location is not null
     and new.location is not null
     and st_distance(new.location, new.venue_location) > 150 then
    select analytics_opted_in into opted_in from profiles where id = new.user_id;
    if coalesce(opted_in, false) then
      update venue_checkins
      set ended_at = now()
      where user_id = new.user_id and ended_at is null;
    end if;

    new.venue := null;
    new.venue_location := null;
  end if;
  return new;
end $$;

-- ── K-anonymity helper for the future aggregation layer ─────────────
-- Pattern for any external-facing aggregate query: wrap counts in this
-- helper; it returns null (representing "insufficient data") if the
-- cohort is smaller than the threshold. Centralizing the rule means
-- the threshold lives in one place; no aggregate query should bypass it.
--
-- Usage:
--   select k_anonymous_count(count(*), 10)
--   from venue_checkins
--   where venue_text = 'Blue Bottle Coffee';

create or replace function k_anonymous_count(p_count bigint, p_threshold int default 10)
returns bigint
language sql
immutable
parallel safe
as $$
  select case when p_count >= p_threshold then p_count else null end;
$$;

comment on function k_anonymous_count is
  'Privacy guard for aggregations exposed externally. Returns null when '
  'cohort size is below the threshold (default 10) — render as '
  '"insufficient data" in any UI that exposes it.';
