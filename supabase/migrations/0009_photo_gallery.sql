-- Multi-photo gallery. `photos` is the source of truth; `photo_url` is kept
-- as the canonical "first photo" so existing reads keep working.

alter table profiles
  add column if not exists photos text[] not null default '{}';

-- Backfill: copy existing photo_url into photos for rows that don't have any.
update profiles
set photos = array[photo_url]
where photo_url is not null
  and (photos is null or coalesce(array_length(photos, 1), 0) = 0);

-- Update nearby() to return photos array too.
-- Drop required because return type changes are not allowed via CREATE OR REPLACE.

drop function if exists nearby(geography, int);

create or replace function nearby(my_location geography, radius_m int)
returns table (
  id uuid,
  name text,
  photo_url text,
  photos text[],
  bio text,
  interests text[],
  status text,
  distance_m float
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.interests, pr.status,
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
