-- Test seed: creates 5 fake users with profiles + presence near a given coord.
--
-- Usage in SQL Editor:
--   select seed_test_users(37.4220, -122.0841);  -- default Pixel emulator (Mountain View, CA)
--
-- Re-run any time presence goes stale (>5 min old). It upserts cleanly.
-- Each fake user is placed in a small ring within ~50m of the center.

create or replace function seed_test_users(center_lat float, center_lng float)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  user_data jsonb := '[
    {"email": "maya-test@ember.dev",  "name": "Maya",  "bio": "always down for a coffee.",   "photo": "https://i.pravatar.cc/300?img=47", "status": "open"},
    {"email": "theo-test@ember.dev",  "name": "Theo",  "bio": "writer, mediocre cook.",       "photo": "https://i.pravatar.cc/300?img=12", "status": "connect"},
    {"email": "naomi-test@ember.dev", "name": "Naomi", "bio": "deep in a book today.",        "photo": "https://i.pravatar.cc/300?img=32", "status": "focus"},
    {"email": "daria-test@ember.dev", "name": "Daria", "bio": "let''s skip small talk.",       "photo": "https://i.pravatar.cc/300?img=5",  "status": "spark"},
    {"email": "felix-test@ember.dev", "name": "Felix", "bio": "new to the city.",             "photo": "https://i.pravatar.cc/300?img=60", "status": "open"}
  ]'::jsonb;
  rec jsonb;
  uid uuid;
  off_lat float;
  off_lng float;
  i int := 0;
begin
  for rec in select * from jsonb_array_elements(user_data) loop
    i := i + 1;
    off_lat := center_lat + (0.0004 * cos(i * 1.25));
    off_lng := center_lng + (0.0004 * sin(i * 1.25));

    select id into uid from auth.users where email = rec->>'email';

    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, email, role, aud, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, email_confirmed_at, encrypted_password
      ) values (
        uid,
        '00000000-0000-0000-0000-000000000000',
        rec->>'email',
        'authenticated',
        'authenticated',
        now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{}'::jsonb,
        now(),
        ''
      );
    end if;

    insert into profiles (id, name, photo_url, bio)
    values (uid, rec->>'name', rec->>'photo', rec->>'bio')
    on conflict (id) do update set
      name = excluded.name,
      photo_url = excluded.photo_url,
      bio = excluded.bio;

    insert into presence (user_id, status, location, accuracy_m, updated_at)
    values (
      uid,
      rec->>'status',
      st_setsrid(st_makepoint(off_lng, off_lat), 4326)::geography,
      10,
      now()
    )
    on conflict (user_id) do update set
      status = excluded.status,
      location = excluded.location,
      accuracy_m = excluded.accuracy_m,
      updated_at = excluded.updated_at;
  end loop;
end $$;

-- Test seed: drops fake users CHECKED IN (dwell-confirmed) at a seeded venue, so
-- the "Here at {venue}" co-presence section has someone to show. You still have
-- to be dwell-confirmed at the same venue yourself for it to appear.
--
--   select seed_test_copresence();                          -- default test venue
--   select seed_test_copresence('Blue Bottle Coffee');      -- a specific venue
--
-- Re-run if it goes stale (>5 min). Clean up with:
--   delete from auth.users where email like 'copre-%@anor.test';
create or replace function seed_test_copresence(p_venue_name text default 'Test Venue (delete me)')
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_loc geography;
  user_data jsonb := '[
    {"email": "copre-ada@anor.test",  "name": "Ada",  "bio": "here for the playlist.", "photo": "https://i.pravatar.cc/300?img=20", "status": "open"},
    {"email": "copre-juno@anor.test", "name": "Juno", "bio": "skip the small talk.",    "photo": "https://i.pravatar.cc/300?img=15", "status": "spark"}
  ]'::jsonb;
  rec jsonb;
  uid uuid;
begin
  select id, location into v_id, v_loc
  from venues where name = p_venue_name and active limit 1;
  if v_id is null then
    raise exception 'No active venue named %, seed it first', p_venue_name;
  end if;

  for rec in select * from jsonb_array_elements(user_data) loop
    select id into uid from auth.users where email = rec->>'email';
    if uid is null then
      uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, email, role, aud, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, email_confirmed_at, encrypted_password
      ) values (
        uid, '00000000-0000-0000-0000-000000000000', rec->>'email',
        'authenticated', 'authenticated', now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), ''
      );
    end if;

    insert into profiles (id, name, photo_url, bio)
    values (uid, rec->>'name', rec->>'photo', rec->>'bio')
    on conflict (id) do update set
      name = excluded.name, photo_url = excluded.photo_url, bio = excluded.bio;

    -- venue_since 10 min ago → already past the 4-min dwell threshold.
    insert into presence (user_id, status, location, accuracy_m, venue_id, venue_since, updated_at)
    values (uid, rec->>'status', v_loc, 10, v_id, now() - interval '10 minutes', now())
    on conflict (user_id) do update set
      status = excluded.status,
      location = excluded.location,
      accuracy_m = excluded.accuracy_m,
      venue_id = excluded.venue_id,
      venue_since = excluded.venue_since,
      updated_at = excluded.updated_at;
  end loop;
end $$;
