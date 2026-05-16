-- Security advisor fixes. Apply to existing projects to clear lint warnings.
-- Fresh setups: 0001 and 0002 source files have been updated with the same fixes baked in.

-- ── Pin search_path on all our functions ────────────────────────────
-- Prevents search-path hijacking if an attacker can write to a schema in the search path.

alter function public.nearby(geography, int) set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.enforce_message_cap() set search_path = public, pg_temp;
alter function public.on_message_insert() set search_path = public, pg_temp;

-- ── Explicit revoke from anon on nearby() ───────────────────────────
-- Belt-and-suspenders: `revoke from public` should cover anon but the linter
-- prefers the explicit form.

revoke execute on function public.nearby(geography, int) from anon, public;
grant execute on function public.nearby(geography, int) to authenticated;

-- ── Drop the overly permissive storage SELECT policy ────────────────
-- `profile-photos` is a public bucket — files are served via direct CDN URLs
-- without needing a SELECT policy. The previous policy let anyone LIST every
-- file in the bucket, which is broader access than we need.

drop policy if exists "profile-photos public read" on storage.objects;

-- ── Deferred (intentionally not fixed here) ─────────────────────────
-- 1. PostGIS in `public` schema (extension_in_public + downstream
--    st_estimatedextent SECURITY DEFINER warnings). Moving postgis to a
--    dedicated `extensions` schema requires dropping `presence.location`
--    and recreating it — destructive. Do this before any real users exist
--    in production. See: https://supabase.com/docs/guides/database/extensions/postgis
-- 2. `auth_leaked_password_protection` — not applicable; magic-link-only auth.
