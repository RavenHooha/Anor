-- Enrich venue_copresence() with the same supporter columns nearby() returns
-- (0033), so "Here now" cards render founding badges / supporter accents
-- consistently with the nearby feed. Pure additive replace of the function.

create or replace function venue_copresence()
returns table (
  id uuid,
  name text,
  photo_url text,
  photos text[],
  bio text,
  interests text[],
  connect_prefs text[],
  age int,
  status text,
  venue text,
  distance_m float,
  created_at timestamptz,
  tier text,
  is_founding boolean,
  accent_color text,
  profile_theme text,
  profile_background text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with me as (
    select venue_id
    from presence
    where user_id = auth.uid()
      and venue_id is not null
      and venue_since <= now() - interval '4 minutes'
      and updated_at > now() - interval '5 minutes'
  )
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.interests,
         p.connect_prefs, p.age, pr.status, v.name as venue,
         0::float as distance_m,
         p.created_at,
         s.tier,
         coalesce(s.tier is not null and s.is_founding, false) as is_founding,
         case when s.tier is not null then p.accent_color end,
         case when s.tier is not null then p.profile_theme end,
         case when s.tier is not null then p.profile_background end
  from me
  join presence pr on pr.venue_id = me.venue_id
  join venues v on v.id = pr.venue_id
  join profiles p on p.id = pr.user_id
  left join subscriptions s
    on s.user_id = p.id
   and s.status = 'active'
   and s.current_period_end > now()
  where pr.user_id != auth.uid()
    and pr.venue_since <= now() - interval '4 minutes'
    and pr.updated_at > now() - interval '5 minutes'
    and pr.status is not null
    and pr.status <> 'focus'
    and not is_blocked(auth.uid(), p.id)
  order by pr.venue_since asc
  limit 100;
$$;

revoke execute on function venue_copresence() from anon, public;
grant execute on function venue_copresence() to authenticated;
