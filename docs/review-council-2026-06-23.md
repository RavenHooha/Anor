# Anor Review Council — 2026-06-23

Six domain-specialist agents reviewed the codebase in parallel; a Chair synthesized one verdict. Recovered from session task cache after the live thread was summarized away.

## Overall read

Genuinely good shape for a solo pre-launch app — privacy-as-architecture, mission alignment, and code legibility are above what most reviews find, and multiple seats independently confirmed the careful parts (RPC gating, opt-in analytics enforced at write-time, deletion cascades) actually hold. Two things undercut it: the careful Postgres privacy layer is bypassable today via two un-tightened RLS policies from migration 0001, and the headline "find people near you" feature is the least reliable, least observable part of the app. What remains is not structural rebuild — it's closing a few sharp gaps before users touch it.

## Prioritized items (merged across seats)

### 1. [BLOCKER — Security] Any authenticated user can self-promote to `is_admin = true`
The `profiles` UPDATE policy in `supabase/migrations/0001_initial.sql:61-62` has no `WITH CHECK`; `is_admin` (added in `0025`) lives on that same row, and the client writes to `profiles` directly with the anon key. Self-promotion unlocks ban/delete of any account and reading every user's messages.
**Next step:** Add a `WITH CHECK` that pins `is_admin` (and analytics columns) to their current value, or move `is_admin` to a separate table with no authenticated write policy; keep bootstrap as a service_role-only op.

### 2. [BLOCKER — Security + Privacy] Raw GPS in `presence` is readable directly, bypassing `nearby()` bucketing
`0001_initial.sql:64-65` grants table-wide SELECT on `presence` to any authenticated user; `presence.location` holds full-precision GPS. A client with the anon key can `select user_id, st_astext(location) from presence` and get every active user's exact coordinates — defeating the entire distance-bucketing investment in `0016`, plus ignoring block and staleness filters. The precise failure mode PRIVACY.md was written to prevent.
**Next step:** Drop the table-wide SELECT on `presence`; restrict to `auth.uid() = user_id` (self only) and serve everyone else's data exclusively through `nearby()`. Review the `profiles` SELECT policy at `0001:57-58` the same way (it currently exposes `is_admin`, `analytics_opted_in`, `hide_message_preview` to all).

### 3. [HIGH — Privacy] Raw Supabase `user_id` shipped to PostHog via `identify()`
`App.tsx:96` → `src/lib/analytics.ts:64-67` passes the raw UUID to a US-cloud third party — exactly the external re-identification join key PRIVACY.md rule 7 forbids. Combined with #5, an opted-in user's movements become externally linkable.
**Next step:** Send a server-salted hash of `user_id` as the PostHog `distinct_id`, or drop `identify()` and go anonymous/device-scoped.

### 4. [HIGH — Reliability] The headline proximity feature is unreliable and invisible
BLE is entirely absent on iOS (`service.ts:64`), dies on Android the moment the screen sleeps (`isBackgroundEnabled:false`, no foreground service), can silently fail to advertise on common chipsets (`service.ts:83-86` empty `catch {}`), and may be scanning on a service UUID that isn't in the advertised payload (`service.ts:77` vs `:95-98`) — all with zero telemetry.
**Next step:** Three deliberate decisions: (a) iOS — ship BLE or remove the unused Bluetooth-Always permission from `app.json` before App Review rejects it; (b) Android background — foreground service or explicitly frame BLE as "actively looking now"; (c) instrument advertise-failure with a Sentry tag + PostHog event, and verify scan-match on two physical Android devices. Replace the `0xFFFF` SIG test company ID before any real deployment.

### 5. [MEDIUM — Privacy] `venue_checkins` stores point-precision GPS
`0015_venue_checkins.sql:10` / `0019:66-67` store `start_location` at full precision; `venue_text` already captures the bucket the contract wants. Rows persist up to ~2 months before monthly rollup — violating PRIVACY.md rule 3. This is the multiplier that makes #3 dangerous.
**Next step:** Drop `start_location`, or store only a ~1km geohash/neighborhood. Then add not-yet-rolled-up check-ins to `export_my_data()` and soften its misleading "already deleted" note.

### 6. [MEDIUM — UX/Mission] Loading and empty states are bare
Every async screen flashes a blank dark rectangle with no spinner/skeleton (Home, Profile, EditProfile, Chat); the empty Home feed is one faint caption line. For a connection app launching at low density, the empty/sparse feed *is* the default first-user experience — and it gets the least design attention on the screen.
**Next step:** Add `ActivityIndicator`/skeletons to the gates; give the empty feed a real treatment (icon + body copy + "widen radius"). Bring it to the polish bar the profile/tag system already sets.

### 7. [MEDIUM — Product] The mission's PRIMARY deliverable has zero repo artifact
MISSION.md says the giving/transparency/replicability model *is* the mission and the app is just the funding mechanism — yet there's no `docs/giving/` content, no LICENSE, no root README, nothing copyable. A closed, unlicensed repo is not "replicable."
**Next step:** Cheap and pre-revenue: root README stating the model + linking MISSION.md, a `docs/giving/2026.md` stub ("Pre-revenue. $0 given."), and a LICENSE decision. Don't ship in-app mission marketing yet (correctly deferred).

## Genuine tensions between seats

- **Privacy/Security vs. Architecture.** Security wants `presence`/`profiles` reachable *only* through SECURITY DEFINER RPCs. Architecture wants generated Supabase types (presumes broad direct table reads). Resolve in order: fix RLS first, then generate types against the locked-down schema.
- **Reliability (decide iOS now) vs. Product (defer iOS).** Keep iOS deferred as a product decision, but still remove the unused Bluetooth permission string now — deferral is a reason to clean up dead config, not leave it.
- **Polish sequencing.** Product's framing wins on leverage: empty-state + onboarding placement before generic loading-skeleton work.
- **Feature gravity vs. monetization.** The same `venue_checkins` table is both the privacy liability (#5) and the seed of the future B2B product. Keep the venue layer walled off; gate any external aggregate endpoint behind `k_anonymous_count` before it ships.

## What's genuinely strong already

- Privacy enforced in code, not copy (PostHog never instantiated for opted-out users; venue check-ins gated at write time; opt-in default).
- RPC/admin/messaging/secrets core is sound (every `admin_*` checks `is_admin()` and is revoked from anon; bidirectional block enforcement; `search_path` pinned; `.env` untracked; banned emails SHA-256 only). The two RLS holes are the exception that undercuts an otherwise solid layer.
- Deletion, export, and Sentry scrubbing are real (`delete_my_account()` cascades all FKs + removes `auth.users`; `sendDefaultPii:false`, nulls `event.user`, strips breadcrumb bodies; admin reads audit-logged).
- Code is legible and consistent (strict tsconfig, no `any` leaks, real design system, clean status-machine hooks).
- Profile tag system (interests + connect-prefs) is genuinely finished — the polish bar the rest should reach.
- Roadmap discipline actively defends the mission against its own monetization.
- Ops hygiene above average (presence TTL self-expires backgrounded users, sourcemap upload wired, the `react-native-ble-advertiser` patch fixes the new-arch break).

## The single highest-leverage thing to do next

**Close the two RLS holes in migration 0001 (#1 and #2) — before anything else.** They're reachable today with the shipped anon key and the Supabase client already in the app, they convert the entire careful privacy architecture into theater, and one (self-promotion to admin) is a full account-takeover-and-mass-delete primitive. Fix the RLS, re-run the Supabase linter, re-test `nearby()` and messaging to confirm legitimate RPC paths still work, then move to the PostHog/`venue_checkins` privacy pair and the BLE decisions.
