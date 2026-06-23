-- Security hygiene pass surfaced by the review council (all low-severity,
-- defense-in-depth — no active exploit):
--
-- 1. maker_list_users is privileged raw-data access (the maker-only directory),
--    but it wasn't logged. PRIVACY.md requires privileged access to be "logged
--    and reviewed". Add an audit_log row per call. (This makes the function
--    side-effecting, so it must be VOLATILE, not STABLE.)
--
-- 2. The presence self-update policy had USING but no WITH CHECK, so the row
--    could in principle be updated to a different user_id. presence.user_id is
--    the PK and FK to the caller, but add WITH CHECK for parity with the now-
--    explicit profiles policy (0030) — belt and suspenders.

-- ── 1. Audit the maker-only user directory ──────────────────────────────

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
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if not is_maker() then
    raise exception 'Not authorized';
  end if;

  -- Privileged raw-data access is logged and reviewable (PRIVACY.md).
  insert into audit_log (actor_id, action, details)
  values (
    me,
    'maker_list_users',
    jsonb_build_object('search', p_search, 'limit', p_limit, 'offset', p_offset)
  );

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

-- ── 2. presence self-update: add the missing WITH CHECK ─────────────────

drop policy if exists "presence self-update" on presence;
create policy "presence self-update" on presence
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
