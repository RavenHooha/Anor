# Anor integrations & external services

_Last updated: 2026-05-17_

Every external service Anor depends on. Used for: budget tracking,
credential rotation, disaster recovery, privacy audits (GDPR Article 30
record of processing), and onboarding any future contributors.

## At-a-glance

| Service | Used for | Tier | Status | Sees user data? |
|---------|----------|------|--------|-----------------|
| **Supabase** | Auth, Postgres DB, Storage, Realtime | Free | Active | Yes — full |
| **Expo / EAS** | Build pipeline, OTA updates, push relay | Free | Active | Push token + bundle metadata only |
| **Firebase (FCM)** | Android push delivery | Free (Spark) | Active | Push token + notification payload |
| **Apple APNs** | iOS push delivery | $99/yr Apple Dev | Not yet | Push token + notification payload |
| **GitHub** | Source repo, docs hosting (raw URLs) | Free | Active | Code only, no user data |
| **PostHog** | Product analytics | Free | Planned | Yes — anonymized per opt-in |
| **Sentry** | Crash reporting | Free | Active | Stack traces + device meta (scrubbed) |
| **Habitat for Humanity WNC** | Mission recipient (not an API) | — | Default recipient per MISSION.md | No |

---

## Supabase

**What:** Single Postgres-backed backend — handles authentication
(magic-link OTP + PKCE), Postgres database with PostGIS, file storage
(profile photos), realtime subscriptions, and edge functions.

**Project URL:** `https://fxdgytpnzijigvyhumid.supabase.co`
**Project ref:** `fxdgytpnzijigvyhumid`
**Dashboard:** [supabase.com/dashboard](https://supabase.com/dashboard)
**Account owner:** RavenHooha

**Credentials:**
| Key | Where stored | Visibility |
|-----|--------------|------------|
| `EXPO_PUBLIC_SUPABASE_URL` | EAS env vars + local `.env` | Plaintext (safe to expose) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | EAS env vars + local `.env` | Plaintext (designed to be public; RLS enforces access) |
| `service_role` key | Supabase Dashboard only | **NEVER** in client code or git. Used only in SQL Editor or admin scripts. |

**Rotation:** Dashboard → Project Settings → API → "Reset" anon/service_role keys. Anon rotation requires republishing app via OTA. Service role rotation requires updating wherever it's stored.

**Extensions enabled:** PostGIS (location), pg_cron (cleanup scheduling), pg_net (push triggers).

**Privacy:** Stores all user data — profiles, messages, photos, presence, blocks, reports, audit log. Subject to PRIVACY.md retention rules (90-day message cleanup, monthly venue rollup, etc.).

---

## Expo / EAS

**What:** Build pipeline (`eas build`), OTA JS updates (`eas update`), Expo Push Service for notification relay, dev-client distribution.

**Project ID:** `6444dc22-8615-4a6a-bf8b-24821eef1f66`
**Slug:** `anor`
**Dashboard:** [expo.dev/accounts/ravenhooha/projects/anor](https://expo.dev/accounts/ravenhooha/projects/anor)
**Account owner:** ravenhooha

**Credentials:**
| Item | Where stored |
|------|--------------|
| Android keystore | Managed by EAS Credentials |
| FCM Service Account JSON | Uploaded to EAS Credentials → Android → Push Notifications |
| EAS env vars (Supabase + dev creds) | EAS Dashboard → Environment Variables |

**Rotation:** Project Settings → Credentials. Re-uploading FCM Service Account doesn't require rebuild (server-side). Keystore rotation is destructive — only do this if compromised (it would orphan everyone who installed the previous build on Play Store).

**Cost watch:** Free tier covers most needs. EAS Build is 30 builds/month free; we're well under. OTA updates are billed per MAU above 1k free MAU — keep an eye on this once we have real users.

**Privacy:** Sees Expo Push tokens and the notification payload at relay time (Expo doesn't store the message body long-term, but it does pass through their service to FCM/APNs).

---

## Firebase Cloud Messaging (FCM)

**What:** Google's required push delivery service for Android. Used by Expo Push Service as the actual delivery layer for Android notifications.

**Console:** [console.firebase.google.com](https://console.firebase.google.com)
**Account owner:** RavenHooha

**Credentials:**
| Item | Where stored |
|------|--------------|
| `google-services.json` | Repo root (committed — not a secret) |
| Service Account JSON (private key) | Uploaded to EAS only. **NEVER commit.** |

**Rotation:** Firebase Console → Project Settings → Service Accounts → Generate new private key. Then re-upload to EAS Credentials → Android → FCM V1. Old key is revoked automatically.

**Cost watch:** Spark (free) tier supports unlimited FCM messages. We're not using any other Firebase service.

**Privacy:** Sees push tokens (already device-bound, not user-identifying on their own) and notification payloads at delivery time. If `hide_message_preview` is on, payload is generic ("You have a new message").

---

## Apple APNs

**Status:** Not configured. Required if we ever ship to iOS.
**Cost:** Requires Apple Developer Program enrollment ($99/yr).
**Notes:** When we set this up, we'll need a `.p8` key from Apple Developer Portal + Team ID + Key ID, uploaded to EAS Credentials → iOS → Push Notifications.

---

## GitHub

**Repo:** [github.com/RavenHooha/Anor](https://github.com/RavenHooha/Anor)
**Account owner:** RavenHooha

**Uses:**
- Source code hosting.
- Docs are rendered at `github.com/RavenHooha/Anor/blob/main/docs/X.md` — currently the URLs for TOS, privacy policy, and mission page in `src/lib/links.ts`. Replace with `anor.app` URLs (or wherever you host) before store submission.

**Privacy:** No user data. Public repo means MISSION.md and PRIVACY.md commitments are visible to anyone — which is intentional.

---

## PostHog (planned)

**What:** Product analytics — what screens users open, where they drop off, what they tap. Free tier covers 1M events/month, plenty for the foreseeable future.

**Setup notes:**
- Sign up at [posthog.com](https://posthog.com), create project, copy API key.
- Add `EXPO_PUBLIC_POSTHOG_KEY` as EAS env var (Plaintext, all environments).
- Wrap App with `<PostHogProvider apiKey={...}>`.
- Pure JS install — OTA-deployable, no rebuild needed.

**Privacy:** PostHog runs in the user's app and reports back. We'll respect the existing `analytics_opted_in` flag — don't initialize PostHog at all if user is opted out. Document this in PRIVACY_POLICY.md when wired up.

---

## Sentry

**What:** Crash reporting — stack traces, breadcrumbs, device meta when the app crashes. Free tier is 5k errors/month.

**Org:** `ravenhooha`
**Dashboard:** [ravenhooha.sentry.io](https://ravenhooha.sentry.io)
**Account owner:** RavenHooha

**Credentials:**
| Item | Where stored | Visibility |
|------|--------------|------------|
| `EXPO_PUBLIC_SENTRY_DSN` | EAS env vars | Plaintext (designed public; only allows *sending* events) |
| `SENTRY_AUTH_TOKEN` | EAS env vars | **Secret** (org:ci scope — uploads sourcemaps at build time) |
| `SENTRY_ORG` and `SENTRY_PROJECT` | EAS env vars | Plaintext (used by metro config for sourcemap upload) |

**Rotation:** Auth token: Sentry Settings → Organization Tokens → revoke + create new + update EAS env. DSN: Project Settings → Client Keys → "Regenerate" + update EAS env + rebuild.

**Privacy scrubbing (configured in App.tsx Sentry.init):**
- `sendDefaultPii: false` — no IP, cookies, or auto-captured user identifiers.
- HttpClient breadcrumb integration disabled — no fetch/XHR bodies captured (would otherwise leak message text + Supabase auth tokens).
- `beforeSend` strips `event.user` and `event.request.headers` defense-in-depth.
- `beforeBreadcrumb` blanks `body`/`response`/`request` keys on any breadcrumb data object.

**Environment tagging:** uses `Updates.channel` to tag each event as `development`, `preview`, or `production` so the dashboard can filter cleanly.

**Sourcemap upload:** metro.config.js wraps the default Expo Metro config with `getSentryExpoConfig`, which uploads sourcemaps to Sentry on each EAS build using `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`. Without this, release-build crash traces are minified gibberish.

---

## Future / conditional integrations

These come into scope if/when the relevant feature is built. Not active.

- **Stripe** — paid consumer tier billing. Subject to PCI compliance considerations; Stripe handles the heavy lifting.
- **AWS Rekognition / Google Vision** — proactive photo content moderation. Pay-per-image. Currently we have admin takedown only.
- **Twilio** — SMS verification. Only needed if we add phone-based 2FA.
- **Mapbox / Google Maps** — if we ever show a map of nearby users (currently we only show cards). Mapbox free tier is more generous than Google.
- **Resend / Postmark / SendGrid** — transactional email. Supabase handles auth emails today; would need this if we add anything beyond.

---

## Account access checklist (for disaster recovery)

If you ever lose access to your computer, you'll need:

- **Supabase** account credentials (email + recovery)
- **Expo** account credentials
- **Firebase / Google** account credentials
- **GitHub** account credentials
- **Apple Developer** (when added)
- **PostHog** account credentials (when added)
- **Sentry** account credentials (when added)

Strongly recommend a password manager + 2FA on every one of these. The Supabase service_role key + EAS access alone gives full control over the running app.
