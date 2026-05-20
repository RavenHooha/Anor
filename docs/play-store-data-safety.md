# Play Store Data Safety — Anor

Source-of-truth for the answers to Google Play Console's Data Safety
form. Update this doc when the data model or third-party services
change, then mirror those changes into the Play Console form.

Last verified against the code: 2026-05-19.

## Overview tab

| Question | Answer |
|---|---|
| Does your app collect or share any required user data? | **Yes** |
| Is all user data encrypted in transit? | **Yes** (HTTPS/TLS for Supabase, Resend, FCM, Sentry, PostHog) |
| Provide a way for users to request data deletion? | **Yes** |
| Independent security review? | **No** (not yet — park for post-funding) |

## Data collection and security

| Question | Answer |
|---|---|
| Account creation method | **Username and other authentication** (email is the username; magic link is an OTP delivered via email — explicitly listed in Google's examples for "other authentication") |

## Data types collected

For each row: **all are Collected** (sent off-device to Supabase or another
data processor). **None are Shared** in Google's sense (sent to a third
party for *their own use*). Processors operating on Anor's behalf —
Supabase, Resend, FCM, Sentry, PostHog — don't count as sharing.

### Location

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| Precise location | App functionality | Required | Core proximity feature. Stored in `presence.location` (PostGIS point). |
| Approximate location | App functionality | Required | Same source as precise; coarsening happens at query time for distance display. |

### Personal info

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| Name | App functionality | Required | `profiles.name`. User-provided. |
| Email address | App functionality, Account management | Required | Used as the magic-link auth identifier. Stored in `auth.users`. |
| User IDs | App functionality | Required | Supabase auth UUIDs (`auth.users.id`, used as `profiles.id`). |

### Messages

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| Other in-app messages | App functionality | Required | `messages.body` (chat). Auto-deletes after 90 days (migration 0020). |

### Photos and videos

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| Photos | App functionality | **Optional** | Profile photo. Stored in Supabase Storage; URL in `profiles.photo_url`. User can skip. |

### App activity

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| App interactions | Analytics | **Optional** | PostHog. SDK is **not initialized** until the user opts in via Settings → "Help improve Anor." If opted out, zero analytics events are sent. |
| Other user-generated content | App functionality | Optional | Bios, interests, venue check-in tags. |

### App info and performance

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| Crash logs | App functionality | Required | Sentry. PII stripped via `beforeSend` (no `event.user`, no `request.headers`, body/response blanked). |
| Diagnostics | App functionality | Required | Sentry performance traces, same PII-strip config. |

### Device or other IDs

| Type | Purpose | Required/Optional | Notes |
|---|---|---|---|
| Device or other IDs | App functionality | **Optional** | FCM push token. Stored in `push_tokens`. Only collected if the user grants notification permission. |

## Data types NOT collected

Explicitly declare these as **not collected** on the Play Console form
to keep the listing accurate:

- Address, phone number, race/ethnicity, political/religious beliefs, sexual orientation
- Financial info (no payments in v1)
- Health and fitness
- Emails or SMS (we don't read inbound mail/SMS; Resend handles outbound on Anor's behalf)
- Videos
- **Audio files** (RECORD_AUDIO permission is declared in `app.json` but no feature actually records audio — see "Cleanup TODO" below)
- Files and docs, calendar, contacts
- In-app search history, installed apps
- Web browsing
- Other actions

## Data sharing

**No data is shared with third parties for their independent use.**

Data processors operating on Anor's behalf (these count as collection,
not sharing, per Google's definitions):

| Service | What it processes | DPA / Sub-processor |
|---|---|---|
| Supabase | Database, auth, storage, realtime | DPA available |
| Resend | Outbound magic-link emails | DPA available |
| Firebase Cloud Messaging | Push notification delivery | Google's standard terms |
| Sentry | Crash reports (PII stripped) | DPA available |
| PostHog | Product analytics (opt-in only) | DPA available |

## Security practices

| Practice | Status |
|---|---|
| Encrypted in transit | Yes — TLS/HTTPS for every outbound request |
| Encrypted at rest | Yes — Supabase default (AES-256) |
| Users can request data deletion | Yes — in-app account deletion + `support@meetanor.com` |
| Data minimization | Yes — messages auto-delete after 90 days (migration 0020); venue check-ins roll up monthly |
| Independent security review | No — not yet performed |
| Follows Play Families Policy | No — app is 18+ only |

## Cleanup TODO

- **Remove `android.permission.RECORD_AUDIO`** from `app.json` permissions. It's vestigial (pulled in by an older BLE library's default permission set) and no feature in `src/` actually records audio. Removing it makes the manifest match the Data Safety declaration exactly and avoids any reviewer questions like "your app declares audio permission but isn't disclosing audio collection."
