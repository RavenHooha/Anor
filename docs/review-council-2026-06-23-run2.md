# Anor Review Council — 2026-06-23 (run 2, against current HEAD)

Six domain seats reviewed current `HEAD`; Chair synthesized. Run caveat: the 3-skeptic adversarial layer did not fire this run (orchestration-script data-flow bug — it received 0 findings). The Chair flagged this honestly and re-verified every load-bearing claim against source instead of citing a non-existent vote. The top security claim (migrations 0030/0032 closing the old blockers) was additionally re-verified by hand.

## Headline

**No exploitable-today security blocker exists.** The two blockers from the 6/16 run — `is_admin` self-promotion and table-wide `presence` GPS exposure — were already closed:
- `0030_rls_privilege_and_presence_lockdown.sql` — re-added `WITH CHECK` on profiles UPDATE, pinned `is_admin`/`created_at` via a trigger (covers UPDATE + INSERT), restricted `presence` SELECT to owner-only.
- `0031_drop_venue_checkin_gps.sql` — dropped raw GPS from venue_checkins.
- `0032_privacy_hardening_pass_3.sql` — locked `profiles` SELECT to owner-only behind `get_public_profile()`, added venue_checkins to export.

RLS-as-real-boundary is now the most mature part of the codebase. The real risk profile is **observability + maintainability**, not security.

## Prioritized items (no confirmed security blockers)

1. **[HIGH — Reliability] Proximity failures are invisible in the field.** `backgroundPresence.ts` records outcomes only via `writeBreadcrumb()` to AsyncStorage (no Sentry/PostHog); `useLocation.ts:51` swallows upsert errors with `.catch(()=>{})`. Solo founder + empty launch geography = core loop can break for every user with zero signal. **Fix:** mirror the existing `ble_advertise_failed` pattern (`service.ts:91-92`) — emit anonymous `presence_checkin_failed` PostHog event + Sentry exception on unexpected paths. *(Chair's #1 pick.)*
2. **[HIGH — Reliability] BLE never detects adapter state.** `service.ts:96-106` only subscribes to `onDiscoverPeripheral`; no `DidUpdateState` listener. Bluetooth off → `status='scanning'`, banner renders nothing → permanent silent empty feed. **Fix:** add `BleManagerDidUpdateState` listener; distinct `'bluetoothOff'` status + "turn on Bluetooth" banner.
3. **[HIGH — Architecture] Untyped Supabase client.** `supabase.ts:14` `createClient` with no `Database` generic; every data fn re-declares a local `RpcRow` and casts (`nearby.ts:35`, `threads.ts:88`, `venues.ts:31`, `realtime.ts:24`). `rpc()` returns `any`, so a column rename across 43 migrations compiles clean and yields `undefined`. **Fix:** `supabase gen types typescript` → `src/types/database.ts`, `createClient<Database>()`.
4. **[HIGH — UX] Zero accessibility.** No `accessibilityLabel/Role/Hint` anywhere; icon-only Pressables unreachable by TalkBack/VoiceOver. Direct contradiction of the ND-as-universal-design mission. **Fix:** mechanical pass over ~8 components.
5. **[MED — Privacy] `presence.location` raw GPS had no retention job.** ✅ FIXED in `0044` — daily job NULLs stale coordinates after 1 day.
6. **[MED — Privacy] `export_my_data()` omitted the user's own presence row.** ✅ FIXED in `0044` — presence row added + note corrected.
7. **[MED — Reliability] BLE double-counts against GPS users.** `HomeScreen.tsx:181-182` sums `generalNearby + bleDevices + hereUsers`; BLE ids don't link to user ids, so one person with GPS+BLE shows as both a card and a MysteryCard. **Fix:** decide BLE's role; stop adding `bleDevices.length` to total or gate MysteryCards.
8. **[MED — Product/Mission] Paywall hardcodes "100% of net profit goes to housing"** (`PaywallScreen.tsx:181`) while pre-revenue/$0 given — violates MISSION.md:278-295. **Fix:** soft-signal copy until first logged contribution.
9. **[MED — Architecture] Full `NearbyUser` passed as nav param** (`navigation/types.ts:15`). **Fix:** pass `{ userId }`, fetch via `get_public_profile`.
10. **[MED — UX] NearbyCard avatar no fallback** for empty `photoUrl` (`nearby.ts:84` maps to `''`; `NearbyCard.tsx:50` renders unconditionally). **Fix:** mirror ChatScreen initial-letter fallback.
11. **[MED — Reliability/Privacy] BLE uses 0xFFFF test company ID + static service UUID** (`constants.ts:3,7`). Presence-detectable (not user-identifiable — payload carries no id). **Fix:** register real company ID before production; decide whether static-UUID advertising ships in v1.
12. **[MED — Product] LICENSE is a placeholder, not full AGPLv3 text** (`LICENSE:25-31`). **Fix:** paste byte-perfect AGPLv3 before repo goes public.

**Lower-severity batch:** stale "opt-OUT" comment in `0019` header; moderation email ships raw UUIDs+names to Resend (low); duplicated nav header blocks; no test harness; inconsistent error handling; low-contrast `textMuted` below WCAG AA; no feed skeleton; `google-services.json` tracked (Firebase client config, not a server secret — decide keep-vs-example before public, confirm API key has package+SHA restrictions).

**Refuted / not action items:** `is_admin` self-promotion + presence GPS exposure (closed by 0030/0032, not regressed); external k-anonymity leak (scaffolding only, no external surface); nearby() triangulation (documented low residual, 50m smallest bucket).

## Tensions

- **BLE ship vs cut:** Android-only, foreground-only, double-counts GPS (#7), rides the fragile patched `react-native-ble-advertiser`. Honest call: lowest-leverage + highest-fragility proximity surface. If timeline tightens, cutting Android advertise from v1 resolves #2/#7/#11 at once. Keep the no-identifier payload (Security is right it's not user-trackable).
- **Generated types vs locked-down RLS:** generate against current locked schema; the generator reflects schema shape not RLS grants — no conflict.
- **Error handling throw vs swallow:** one `reportError(e, tags)` helper satisfies both Architecture (consistency) and Reliability (observability). Serves #1.

## Single highest-leverage next step

**Wire remote telemetry into the proximity failure paths (#1).** Empty launch geography + no test network means your structural blind spot is silent failure, not a security hole. The correct template already exists (`ble_advertise_failed` → Sentry + PostHog). A few hours converts "I hope proximity works" into aggregate signal. Pair with #2 (Bluetooth-off banner).
