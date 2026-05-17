-- Surface profiles.created_at through nearby() so the client can render
-- a "founding member" badge on user cards without an extra round trip.
-- Pure additive — existing callers ignoring the new column are unaffected.

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
  distance_m float,
  created_at timestamptz
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
         end as distance_m,
         p.created_at
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
