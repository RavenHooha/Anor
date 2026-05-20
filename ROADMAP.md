# Anor Roadmap

_Last updated: 2026-05-19_

Parked ideas worth doing later but not now. Each item has a **trigger**
— the condition that makes it worth picking up. Without the trigger,
building it is premature.

## Monetization

### Local meeting spots (paid SMB listings)

A separate, opt-in section in the app showing curated local businesses
where Anor users meet — coffee shops, bars, restaurants, mini-golf,
breweries, etc. Businesses pay a flat monthly fee for featured
placement; users have to tap into the section to see it (no ads in the
main flow).

**Why it fits:** Anor's identity is people meeting in physical space.
Local SMBs are the natural advertiser. Flat monthly fee avoids the
auction/impression dynamics that push toward dark patterns. Pairs
naturally with the B2B venue analytics already planned in PRIVACY.md
— one product, two revenue streams (listing + analytics dashboard).

**Why not now:** Selling monthly subscriptions to small businesses is
heavy sales work — door-knocking, contracts, churn, moderation. Without
users in a single geography, no business will pay. Building the feature
is cheap; running the sales motion is the real cost.

**Trigger to revisit:** ~200 active users in a single geographic area
(likely Sylva/Asheville first).

**Cheap pre-check before building:** one 30-minute coffee with a local
Sylva business owner — "would you pay $X/mo to be listed in an app
showing local meeting spots to people nearby?" Validates demand before
any code is written.

**Framing notes:** Call it "local meeting spots" or similar, not
"ads." The curated/guide framing fits Anor's aesthetic; "ads" doesn't.
Could combine with date-night packages (already on MISSION.md's
"rules in" list).

## Platform

### iOS launch

Ship Anor on iOS via TestFlight, then App Store. ~50% of the US
smartphone market is on iOS, so this eventually doubles the
addressable user base.

**Why it fits:** Expo + EAS Build can produce iOS builds from the
existing codebase without a Mac. Most of the JS/RN code is already
cross-platform. Supabase, Sentry, PostHog, and the Expo permission
plugins all work identically on iOS.

**Why not now:** Two reasons.

1. **Surface area.** Doubling the platform doubles the bugs, support
   load, and review-cycle complexity before the core experience is
   validated on Android. Solo founder bandwidth is the constraint.

2. **BLE on iOS is constrained.** Apple severely restricts third-party
   apps' ability to advertise via BLE in the background — the existing
   `react-native-ble-advertiser` library can't reliably broadcast
   identifying payloads from iOS. iOS-to-iOS BLE proximity won't work
   the same way it does on Android. Need a real architectural decision
   before launch: drop BLE on iOS and lean on geolocation-only via
   Supabase `nearby()`, or use iBeacon mode, or Multipeer Connectivity
   (iOS-only). Most likely answer is "geolocation-only on iOS" — but
   only validate that once we know whether BLE is actually load-bearing
   to the experience on Android.

**Trigger to revisit:** 50-100 active Android users *and* a decision
on whether GPS-only proximity is sufficient (i.e., whether BLE
discovery is materially better than `nearby()` in real use). The
second condition matters more than the first — without it, you might
ship a strictly-inferior iOS app.

**Estimated effort when triggered:**
- Apple Developer account ($99/year) + provisioning: 1 day
- EAS iOS build setup + first cloud build: 1-2 days
- Implement geolocation-only fallback on iOS (or chosen BLE strategy):
  3-7 days
- App Store Connect listing, screenshots, App Privacy disclosures:
  1-2 days
- First App Store review + likely one rejection cycle: 1-2 weeks of
  calendar time, ~1 day of work
- iOS-specific polish from real-device testing: ongoing

Total: ~2-3 weeks of part-time work + $99/yr + 1-2 weeks of calendar
wait for first review.

**Watch-outs:** Apple's App Review may flag proximity/dating-adjacent
apps under guidelines 1.3 (safety) and 4.0 (minimum functionality).
First submission should over-disclose on App Privacy "Nutrition Label"
and emphasize the moderation/reporting infrastructure already in
place.

### iOS BLE — updated feasibility (Tier 1 vs Tier 2)

Earlier framing treated iOS BLE as a near-blocker. After auditing the
actual code, that was too pessimistic. Two tiers:

- **Tier 1 — ship iOS GPS-only.** BLE stays Android-only (it already
  is: `startBle()` returns early when `Platform.OS !== 'android'`).
  iOS users are discovered via `nearby()` / GPS. This removes the
  BLE-build risk entirely and is the v1.
- **Tier 2 — foreground BLE on iOS.** Genuinely viable as a follow-up,
  not a rewrite. Revisit only if "same-room" RSSI precision proves to
  materially beat GPS in real Android use.

**Why Anor's BLE design already fits iOS** (three alignments):
1. **Foreground-only** (`isBackgroundEnabled: false`) — sidesteps every
   iOS *background* BLE limitation, which is where the real pain is.
2. **No identity in the advertisement** — Anor broadcasts only a shared
   service UUID, so iOS's "can't broadcast a payload in background"
   restriction doesn't apply.
3. **Minimal payload** — advertises the service UUID only, no device
   name / manufacturer data / TX power (`service.ts` `broadcast(...)`),
   so iOS advertisement-field truncation is a non-issue.

**The one real engineering change Tier 2 needs — RSSI tuning.** iOS
coalesces scan callbacks even with `allowDuplicates: true`, so the
fixed 10-sample window (`RSSI_WINDOW`) fills slower and strong/medium/
weak transitions lag. Fix is tuning, not library replacement:
- Quick: platform-specific constants (smaller iOS window ~4) + add
  hysteresis to `rssiToSignal` so labels don't flicker.
- Better: replace the fixed-window average with a time-weighted
  exponential moving average (EMA) — robust to both Android's noisy
  high-frequency stream and iOS's sparse one, one algorithm.

**The real build risk:** `react-native-ble-advertiser@0.0.17` is old
and already patched. The risk is its iOS wrapper (CBPeripheralManager
init, poweredOn handling, lifecycle) under RN 0.81 new arch — not the
iOS BLE stack itself. De-risk cheaply with an EAS iOS *simulator* build
(no paid Apple account needed, verifies compilation), then a physical-
iPhone spike.

**On-device test matrix (Tier 2 spike, real hardware only):**
- Advertisement visibility: iPhone<->iPhone and iPhone<->Android, after
  screen lock, app minimize, reopen, interruptions.
- Lifecycle resilience: hot reload, background transitions, suspension
  (old RN BLE wrappers commonly rot here).
- RSSI cadence: how fast strong/medium/weak transitions feel vs Android.

## Legal / Structure

### Form the NC single-member LLC

Anor currently operates with **no legal entity** — the founder is
personally the operator. For a "strangers meet in person" app (the
highest-liability consumer category), this is the single biggest
exposure: the ToS disclaimers protect "Anor and its operators," but
with no entity a claim from a meetup-gone-wrong can reach personal
assets. The LLC is the actual liability shield; the ToS language is
only the first line.

**Why not blocking the closed test:** 12 testers poking at the app
aren't meeting strangers in person — the real-world-harm risk only
shows up once the public is using it to actually meet. So this gates
*Production*, not the closed test.

**Trigger:** before applying for / accepting Production access (do it
during the 14-day closed-test window so it's in place in time).

**Steps (founder can self-file, ~$125, ~30 min):**
1. Check LLC name availability on the NC Secretary of State registry
   (sosnc.gov) — e.g., "Anor LLC" or "Anor Technologies LLC".
2. File Articles of Organization online ($125). Effective ~immediately.
3. Get a free EIN from the IRS (irs.gov), instant online.
4. Open a business bank account; route all Anor expenses (domain,
   Supabase, EAS, Resend, Google/Apple dev accounts) through it.
   Keeping LLC and personal funds separate is what *preserves* the
   liability shield — commingling can pierce it.

**Note:** This is step 1 of the MISSION.md structure path
(LLC -> NC Public Benefit Corp at first revenue -> foundation-owned
PBC at sustained profitability). Forming it starts the giving
architecture, not just the liability protection.

### Attorney review of ToS + Privacy Policy

The Terms of Use and Privacy Policy are well-drafted templates but
have **not** been reviewed by a lawyer. The limitation-of-liability
($50 cap on a free app) and indemnification clauses are jurisdiction-
specific and may not hold against a personal-injury claim. Fine for
the closed test; a ~$500-1500 attorney pass is the responsible move
before public launch.

**Trigger:** before public/Production launch, ideally alongside or
just after the LLC formation.

### Business insurance (general liability / E&O)

Not needed for the closed test. Worth getting quotes before scaling,
given the in-person-meeting risk profile. The LLC + attorney-reviewed
ToS + insurance are the three layers that actually close the
liability gap; the ToS clause alone doesn't.

**Trigger:** before meaningful public user volume, or if a
mission-aligned funder/partner requires it.
