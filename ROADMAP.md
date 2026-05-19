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
