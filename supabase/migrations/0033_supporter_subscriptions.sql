-- Supporter subscriptions — a donation-style monthly sub that unlocks
-- cosmetic-only perks (a tiered sun badge + profile customization). No
-- utility/visibility perks: nothing here touches matching, and nothing
-- erodes privacy. Tiers: supporter ($2.99) / patron ($4.99) / benefactor
-- ($9.99). Monthly only (no annual — keeps refund/obligation risk low
-- while Anor is unproven).
--
-- Source of truth for "is this person a paying supporter" is this table,
-- written ONLY by the billing webhook (RevenueCat) via service_role. The
-- client can READ its own row but can NEVER write one — otherwise anyone
-- could self-grant perks. Cosmetic *choices* live on profiles (the client
-- may set them), but they only render when an active sub exists, enforced
-- at read time in the two definer RPCs below.

-- ── subscriptions ────────────────────────────────────────────────────
create table if not exists subscriptions (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  tier               text not null check (tier in ('supporter','patron','benefactor')),
  status             text not null default 'active'
                       check (status in ('active','cancelled','expired')),
  current_period_end timestamptz not null,
  is_founding        boolean not null default false,
  store              text check (store in ('play','app_store')),
  rc_app_user_id     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Read your own subscription. No INSERT/UPDATE/DELETE policy exists, so
-- with RLS on, all client writes are denied by default — only service_role
-- (the billing webhook) bypasses RLS to write rows.
drop policy if exists "subscriptions self-read" on subscriptions;
create policy "subscriptions self-read" on subscriptions
  for select using (auth.uid() = user_id);

-- A sub counts as "active" only while not expired/cancelled AND still inside
-- the paid period. Used by the read RPCs and callable by the client to check
-- its own entitlement.
create or replace function current_subscription_tier(uid uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tier
  from subscriptions
  where user_id = uid
    and status = 'active'
    and current_period_end > now()
  limit 1;
$$;

revoke execute on function current_subscription_tier(uuid) from anon, public;
grant execute on function current_subscription_tier(uuid) to authenticated;

-- ── cosmetic choices on profiles ──────────────────────────────────────
-- Nullable; non-privileged, so the existing self-update policy (0030) lets
-- the owner set them. They only *render* for others when a sub is active.
alter table profiles
  add column if not exists accent_color       text,
  add column if not exists profile_theme      text,
  add column if not exists profile_background text;

-- ── surface badge + cosmetics in the two profile read paths ────────────
-- Both gate cosmetics on an active sub via a LEFT JOIN: tier is null for
-- non-supporters, and the cosmetic columns return null unless tier is set.

create or replace function get_public_profile(target_id uuid)
returns table (
  id uuid,
  name text,
  photo_url text,
  photos text[],
  bio text,
  age int,
  interests text[],
  connect_prefs text[],
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
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.age,
         p.interests, p.connect_prefs, p.created_at,
         s.tier,
         coalesce(s.tier is not null and s.is_founding, false) as is_founding,
         case when s.tier is not null then p.accent_color end,
         case when s.tier is not null then p.profile_theme end,
         case when s.tier is not null then p.profile_background end
  from profiles p
  left join subscriptions s
    on s.user_id = p.id
   and s.status = 'active'
   and s.current_period_end > now()
  where p.id = target_id;
$$;

revoke execute on function get_public_profile(uuid) from anon, public;
grant execute on function get_public_profile(uuid) to authenticated;

-- nearby() return type changes → drop + recreate (mirrors 0029).
drop function if exists nearby(geography, int);

create or replace function nearby(my_location geography, radius_m int)
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
  select p.id, p.name, p.photo_url, p.photos, p.bio, p.interests,
         p.connect_prefs, p.age, pr.status, pr.venue,
         case
           when st_distance(pr.location, my_location) < 250
             then round(st_distance(pr.location, my_location) / 50.0) * 50
           when st_distance(pr.location, my_location) < 2000
             then round(st_distance(pr.location, my_location) / 100.0) * 100
           when st_distance(pr.location, my_location) < 25000
             then round(st_distance(pr.location, my_location) / 500.0) * 500
           else round(st_distance(pr.location, my_location) / 1000.0) * 1000
         end as distance_m,
         p.created_at,
         s.tier,
         coalesce(s.tier is not null and s.is_founding, false) as is_founding,
         case when s.tier is not null then p.accent_color end,
         case when s.tier is not null then p.profile_theme end,
         case when s.tier is not null then p.profile_background end
  from profiles p
  join presence pr on pr.user_id = p.id
  left join subscriptions s
    on s.user_id = p.id
   and s.status = 'active'
   and s.current_period_end > now()
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
