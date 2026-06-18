-- Venues — businesses that appear in the nearby view and post time-bounded
-- "what's on" (specials/events). This is the foundation of the B2B side:
-- local venues are surfaced to people physically near them (pull, default-on
-- — it's useful local info, not a push ad). Contextual, never behavioral: a
-- venue is matched to nearby users locally and never receives user data.
--
-- Phase 1 is admin-seeded (you onboard the first venues by hand). Owner
-- self-serve + billing come later; for now there are no client write paths,
-- only admin RPCs and read access.

-- ── venues ────────────────────────────────────────────────────────────
create table if not exists venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,
  location   geography(point) not null,
  address    text,
  owner_id   uuid references auth.users(id) on delete set null, -- null = admin-managed
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists venues_location_idx on venues using gist (location);

alter table venues enable row level security;

-- Active venues are public local info to any signed-in user. No client write
-- policy → all writes go through admin RPCs (service-definer, is_admin-gated).
drop policy if exists "venues readable" on venues;
create policy "venues readable" on venues
  for select using (active);

-- ── venue_posts ───────────────────────────────────────────────────────
create table if not exists venue_posts (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references venues(id) on delete cascade,
  kind       text not null default 'special'
               check (kind in ('special','event','update')),
  body       text not null,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists venue_posts_venue_idx on venue_posts (venue_id);

alter table venue_posts enable row level security;

drop policy if exists "venue posts readable" on venue_posts;
create policy "venue posts readable" on venue_posts
  for select using (true);

-- ── nearby_venues: places near me + their current live post ────────────
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
    and st_dwithin(v.location, my_location, radius_m)
  order by st_distance(v.location, my_location) asc
  limit 50;
$$;

revoke execute on function nearby_venues(geography, int) from anon, public;
grant execute on function nearby_venues(geography, int) to authenticated;

-- ── admin: seed + manage venues (anor-admin / SQL) ─────────────────────
create or replace function admin_create_venue(
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_category text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  insert into venues (name, category, location, address)
  values (
    p_name, p_category,
    st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography,
    p_address
  )
  returning id into new_id;

  insert into audit_log (actor_id, action, target_id, details)
  values (auth.uid(), 'admin_create_venue', new_id,
          jsonb_build_object('name', p_name));
  return new_id;
end $$;

revoke execute on function admin_create_venue(text, double precision, double precision, text, text) from anon, public;
grant execute on function admin_create_venue(text, double precision, double precision, text, text) to authenticated;

create or replace function admin_add_venue_post(
  p_venue_id uuid,
  p_body text,
  p_kind text default 'special',
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  if p_kind not in ('special','event','update') then
    raise exception 'Invalid kind: %', p_kind;
  end if;
  insert into venue_posts (venue_id, kind, body, ends_at)
  values (p_venue_id, p_kind, p_body, p_ends_at)
  returning id into new_id;
  return new_id;
end $$;

revoke execute on function admin_add_venue_post(uuid, text, text, timestamptz) from anon, public;
grant execute on function admin_add_venue_post(uuid, text, text, timestamptz) to authenticated;

create or replace function admin_list_venues()
returns table (
  id uuid,
  name text,
  category text,
  address text,
  active boolean,
  created_at timestamptz,
  current_post text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Not authorized: admin only';
  end if;
  return query
  select v.id, v.name, v.category, v.address, v.active, v.created_at,
    (select vp.body from venue_posts vp
      where vp.venue_id = v.id
        and vp.starts_at <= now()
        and (vp.ends_at is null or vp.ends_at > now())
      order by vp.created_at desc limit 1) as current_post
  from venues v
  order by v.created_at desc
  limit 500;
end $$;

revoke execute on function admin_list_venues() from anon, public;
grant execute on function admin_list_venues() to authenticated;
