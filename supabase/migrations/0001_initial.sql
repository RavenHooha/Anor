-- Ember initial schema.
-- Apply in Supabase: SQL Editor → paste this → Run.

create extension if not exists postgis;

-- Note: Supabase's linter will flag `public.spatial_ref_sys` as missing RLS.
-- That table is owned by the postgres extension and contains public reference
-- data (~8500 rows of standard SRID definitions). Project owners can't alter
-- it, and enabling RLS would break PostGIS internals anyway. Dismiss the
-- warning in the dashboard — it's a known false positive.

-- 1:1 with auth.users — slowly-changing profile data
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  photo_url text,
  bio text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- frequently-changing: status + last known location
create table presence (
  user_id uuid primary key references profiles(id) on delete cascade,
  status text check (status in ('open','connect','focus','spark')),
  location geography(point, 4326),
  accuracy_m smallint,
  updated_at timestamptz not null default now()
);

create index presence_location_idx on presence using gist (location);
create index presence_updated_at_idx on presence (updated_at);

create trigger presence_set_updated_at
  before update on presence
  for each row execute function set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────

alter table profiles enable row level security;
alter table presence enable row level security;

create policy "profiles readable by authed" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles self-insert" on profiles
  for insert with check (auth.uid() = id);
create policy "profiles self-update" on profiles
  for update using (auth.uid() = id);

create policy "presence readable by authed" on presence
  for select using (auth.role() = 'authenticated');
create policy "presence self-insert" on presence
  for insert with check (auth.uid() = user_id);
create policy "presence self-update" on presence
  for update using (auth.uid() = user_id);

-- ── Nearby query ────────────────────────────────────────────────────

create or replace function nearby(my_location geography, radius_m int)
returns table (
  id uuid,
  name text,
  photo_url text,
  bio text,
  status text,
  distance_m float
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id, p.name, p.photo_url, p.bio, pr.status,
         st_distance(pr.location, my_location) as distance_m
  from profiles p
  join presence pr on pr.user_id = p.id
  where pr.location is not null
    and pr.updated_at > now() - interval '5 minutes'
    and st_dwithin(pr.location, my_location, radius_m)
    and p.id != auth.uid()
  order by distance_m asc
  limit 100;
$$;

revoke execute on function nearby(geography, int) from anon, public;
grant execute on function nearby(geography, int) to authenticated;

-- ── Storage: profile photos ─────────────────────────────────────────
-- Bucket must be created via dashboard first (Storage → New bucket → "profile-photos", public).
-- Then run these policies.

-- Note: no SELECT policy needed — the `profile-photos` bucket is public,
-- so files are served via direct CDN URLs without going through RLS.
-- A broad SELECT policy would let anyone LIST every file in the bucket,
-- which is wider access than we need.

create policy "profile-photos self-write"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "profile-photos self-update"
  on storage.objects for update
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
