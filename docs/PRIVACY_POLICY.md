# Anor Privacy Policy

_Last updated: 2026-05-17_

> **⚠️ Template — needs legal review before broader launch.** This is
> derived from our internal data architecture (see PRIVACY.md) but a
> jurisdiction-aware lawyer should validate it before Play Store
> submission or any EU/CA launch.

## What this policy covers

This policy explains what information Anor collects, how we use it, who
we share it with, and the rights you have over it.

## 1. What we collect

When you use Anor, we collect:

**Account info**
- Email address (used only for sign-in; never sold or shared)
- Authentication tokens managed by our auth provider (Supabase)

**Profile info you provide**
- Name
- Optional age (range 13-120, self-reported)
- Optional bio
- Profile photos
- Optional interests
- Optional venue you've tagged

**Location & proximity**
- Your device's approximate location while the app is in the foreground
  (used to find people near you)
- Bluetooth Low Energy device identifiers you broadcast and receive
  (used for same-room proximity detection)
- Location is stored on our servers and refreshed while you use the app

**Messaging**
- Threads you create and the messages within them
- Block lists and reports you submit

**Device & technical**
- Push notification tokens (Expo Push tokens, used to deliver
  notifications via Apple APNs and Google FCM)
- Platform identifier (Android or iOS)

**Optional analytics** (only if you opt in via Settings → Help improve Anor)
- Records of when and where you tag venues, for aggregate analytics

## 2. How we use it

We use the data above to:
- Show you other Anor users nearby
- Let you message, wave, and connect with other users
- Send you push notifications about messages and waves
- Enforce safety rules (blocks, reports)
- Improve the app (only if you opt in to analytics)

We do **not** use your data for:
- Advertising or ad targeting
- Selling to data brokers
- Building a profile to sell or share with third parties

## 3. Who we share data with

We use a small number of third-party services to operate Anor. Each of
these has its own privacy policy.

- **Supabase** (database, authentication, file storage) — stores your
  profile, messages, photos, and location data on our behalf.
- **Expo Push Service** — relays push notifications to your device.
- **Google Firebase Cloud Messaging (Android)** and **Apple Push
  Notification Service (iOS)** — deliver the notifications to your
  device.

We do not share your data with advertisers, data brokers, or social
media platforms. We do not sell your data.

We may share data when required by law (e.g., responding to a subpoena
or court order). If we receive a legal request, we will notify you when
permitted.

## 4. Aggregate analytics (opt-in only)

If you enable "Help improve Anor" in Settings, two things happen:

1. **Venue check-ins are recorded** so they can be aggregated into
   anonymous monthly trends — for example, "47 users tagged this coffee
   shop on weekday evenings." Any external surface that uses this data
   must include at least 10 users in each result before it's displayed.
2. **Product analytics events** (PostHog) fire — recording when you
   open the app, complete onboarding, set a venue, or send a message.
   These tell us what's working and what's broken. **We never send the
   content of your messages, the names of venues you tag, or any
   identifying information.** Only the fact that the event happened.

If you do NOT enable this toggle, **the PostHog analytics SDK is never
initialized on your device** — not just "initialized and silenced."
Stronger by design.

You can turn this off at any time via Settings. When you turn it off,
we stop recording your check-ins and stop sending analytics events
immediately.

## 5. Your rights

You can:

- **Access** your data via the app (your profile, messages, blocks).
- **Edit** your profile at any time via Edit profile.
- **Delete** your account and all associated data via Settings → Delete
  account. This is immediate and permanent.
- **Block** any user from seeing or contacting you.
- **Report** any user to us for review.
- **Opt out** of analytics (already off by default — opt-in only).

If you're a resident of the European Union, United Kingdom, California,
or another jurisdiction with similar laws, you may have additional rights
including the right to a copy of your data ("data portability") or to
restrict processing. Contact us at the address below to exercise these.

## 6. Data retention

Anor practices **data minimization** — we keep the minimum data needed
to operate the service, and proactively delete data on a schedule
rather than holding it forever. Specifically:

- **Messages and threads** are automatically deleted **90 days after
  the last message in a thread**. There is no opt-out; conversations
  you'd like to keep should be screenshot or saved outside the app.
- **Venue check-ins** (for users who opted in to analytics) are rolled
  up into **anonymous monthly aggregates** ("47 users tagged this
  venue") and the individual records deleted. After rollup, your
  individual venue history no longer exists in our systems.
- **Audit log entries** (records of actions like blocks and reports)
  are kept for **90 days**, then deleted.
- **Resolved reports** are kept for **30 days after review**, then
  deleted.
- **Profile data** (name, photos, bio, interests, age) is kept while
  your account is active.
- **Blocks** are kept indefinitely while your account is active (we
  need to enforce them).

When you delete your account, all your data is removed from active
systems immediately and from backups within 30 days. Aggregated
analytics from check-ins contributed before deletion may persist in
already-computed aggregates, but no individually identifiable trace
remains.

You can download a copy of everything we currently have on you at any
time via Settings → Download my data. Because of the minimization
policies above, that export is small by design.

## 7. Children's privacy

Anor is for users **18 and older**. We do not knowingly collect data
from anyone under 18. If you believe a minor has created an account,
contact us and we will remove it.

## 8. Security

We use HTTPS for all communication between your device and our servers.
Your sign-in is via single-use email links (no password to steal).
Database access is restricted by row-level security policies that limit
each user to their own data. Despite reasonable safeguards, no system
is perfectly secure — please use a strong, unique password on your email
account, since that's how account access is recovered.

## 9. International data transfers

Anor's servers are hosted in the United States. If you use Anor from
outside the US, your data will be transferred to and stored on US
servers.

## 10. Changes to this policy

We may update this policy. Material changes will be announced in-app or
by email. Continued use after a change means you accept the updated
policy.

## 11. Contact

Questions, requests, or complaints? Email **support@meetanor.com**.
