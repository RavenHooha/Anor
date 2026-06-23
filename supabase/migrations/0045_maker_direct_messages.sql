-- Maker direct messages. The founder ("the maker") can open a 1:1 thread with
-- any user and have the first message land directly — not as a pending wave.
--
-- Anor has no global user directory by design, so this adds ONE privileged,
-- maker-only surface (maker_list_users). It is gated on is_maker() and granted
-- to no normal user. It does NOT let the maker read existing private threads —
-- that power stays in the audit-logged admin_* RPCs. This is consensual outbound
-- contact: the maker sends a message the recipient can see, reply to, mute, or
-- block like any other conversation.
--
-- Trust requirements baked in here:
--   * is_maker is a privileged column, pinned against client writes (same guard
--     trigger that protects is_admin) — no user can self-promote to maker.
--   * The maker still cannot message someone who has blocked them (block is
--     respected bidirectionally, exactly like create_or_get_thread).
--   * get_public_profile now returns is_maker so the client can show a verified
--     "maker" badge — the message is always clearly attributed.

-- ── 1. is_maker flag, pinned against client writes ──────────────────────

alter table profiles
  add column if not exists is_maker boolean not null default false;

-- Extend the 0030 privileged-column guard to also pin is_maker. auth.uid() is
-- NULL for service_role / SQL-editor ops, so the maker bootstrap below still
-- passes; only authenticated end-users are blocked from setting it.
create or replace function public.guard_profile_privileged_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'UPDATE' then
      if new.is_admin is distinct from old.is_admin then
        raise exception 'is_admin cannot be changed by the client';
      end if;
      if new.is_maker is distinct from old.is_maker then
        raise exception 'is_maker cannot be changed by the client';
      end if;
      new.created_at := old.created_at;
    elsif tg_op = 'INSERT' then
      new.is_admin := false;
      new.is_maker := false;
    end if;
  end if;
  return new;
end;
$$;

-- ── 2. is_maker() helper (caller is the maker) ──────────────────────────

create or replace function public.is_maker()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
as $$
  select coalesce((select is_maker from profiles where id = auth.uid()), false);
$$;

revoke execute on function public.is_maker() from anon;
grant execute on function public.is_maker() to authenticated;

-- ── 3. maker_list_users: the maker-only directory ──────────────────────

create or replace function maker_list_users(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  name text,
  photo_url text,
  created_at timestamptz,
  has_thread boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if not is_maker() then
    raise exception 'Not authorized';
  end if;

  return query
    select
      p.id,
      p.name,
      p.photo_url,
      p.created_at,
      exists (
        select 1 from threads t
        where t.user_a = least(me, p.id)
          and t.user_b = greatest(me, p.id)
      ) as has_thread
    from profiles p
    where p.id <> me
      and (
        p_search is null
        or btrim(p_search) = ''
        or p.name ilike '%' || btrim(p_search) || '%'
      )
    order by p.created_at desc
    limit greatest(coalesce(p_limit, 50), 1)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function maker_list_users(text, int, int) from anon, public;
grant execute on function maker_list_users(text, int, int) to authenticated;

-- ── 4. start_maker_thread: open/get a thread and post directly ─────────

create or replace function start_maker_thread(p_target_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  tid uuid;
  trimmed text := btrim(coalesce(p_body, ''));
begin
  if not is_maker() then
    raise exception 'Not authorized';
  end if;
  if p_target_id = me then
    raise exception 'Cannot message yourself';
  end if;
  if trimmed = '' then
    raise exception 'Message is empty';
  end if;
  if char_length(trimmed) > 500 then
    raise exception 'Message exceeds 500 characters';
  end if;
  -- Respect blocks bidirectionally — being the maker does not override a block.
  if is_blocked(me, p_target_id) then
    raise exception 'Cannot message this user';
  end if;

  a := least(me, p_target_id);
  b := greatest(me, p_target_id);

  select id into tid from threads where user_a = a and user_b = b;
  if tid is null then
    -- Pre-accept: on_message_insert only auto-accepts for the NON-initiator, and
    -- the maker is the initiator, so set accepted_at now or the maker's own
    -- message would be blocked by the messages insert policy and the thread
    -- would read as a pending wave.
    insert into threads (user_a, user_b, initiator_id, accepted_at)
    values (a, b, me, now())
    returning id into tid;
  else
    -- Existing thread (maybe a stale pending wave) — ensure it's accepted so the
    -- maker can post directly.
    update threads set accepted_at = coalesce(accepted_at, now()) where id = tid;
  end if;

  insert into messages (thread_id, from_user_id, body)
  values (tid, me, trimmed);

  return tid;
end;
$$;

revoke execute on function start_maker_thread(uuid, text) from anon, public;
grant execute on function start_maker_thread(uuid, text) to authenticated;

-- ── 5. Surface is_maker on the public profile for the verified badge ────

drop function if exists get_public_profile(uuid);

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
  profile_background text,
  is_maker boolean
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
         case when s.tier is not null then p.profile_background end,
         coalesce(p.is_maker, false)
  from profiles p
  left join subscriptions s
    on s.user_id = p.id
   and s.status = 'active'
   and s.current_period_end > now()
  where p.id = target_id;
$$;

revoke execute on function get_public_profile(uuid) from anon, public;
grant execute on function get_public_profile(uuid) to authenticated;

-- ── 6. Bootstrap (run manually as service_role / in the SQL editor) ─────
-- The guard trigger only blocks authenticated end-users (auth.uid() is NULL
-- here), so this is the one sanctioned way to grant maker:
--   update profiles set is_maker = true where id = '<your-user-id>';
