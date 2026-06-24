-- Give the "Places nearby" venue list its own bounds, independent of the
-- people-feed radius slider. Two caps:
--   1. Distance: never look past 25 km for venues, even when the user widened
--      the people radius to Region (250 km) or Country (5,000 km). "What's
--      around me" and "who's around me" don't want the same range — a venue
--      300 km away isn't meaningfully "nearby". least(radius_m, 25000) keeps
--      the venue list local while the people feed can still go wide.
--   2. Count: top 20 closest (was 50) — a tighter, more scannable list.
--
-- Signature + return type are unchanged, so create-or-replace (no drop needed).

create or replace function nearby_venues(my_location geography, radius_m int)
returns table (
  id uuid,
  name text,
  category text,
  address text,
  distance_m float,
  post_id uuid,
  post_kind text,
  post_body text,
  post_ends_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    v.id, v.name, v.category, v.address,
    case
      when st_distance(v.location, my_location) < 2000
        then round(st_distance(v.location, my_location) / 50.0) * 50
      else round(st_distance(v.location, my_location) / 500.0) * 500
    end as distance_m,
    p.id, p.kind, p.body, p.ends_at
  from venues v
  left join lateral (
    select vp.id, vp.kind, vp.body, vp.ends_at
    from venue_posts vp
    where vp.venue_id = v.id
      and vp.starts_at <= now()
      and (vp.ends_at is null or vp.ends_at > now())
    order by vp.created_at desc
    limit 1
  ) p on true
  where v.active
    -- Cap the venue search at 25 km regardless of the people radius.
    and st_dwithin(v.location, my_location, least(radius_m, 25000))
  order by st_distance(v.location, my_location) asc
  limit 20;
$$;

revoke execute on function nearby_venues(geography, int) from anon, public;
grant execute on function nearby_venues(geography, int) to authenticated;
