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
