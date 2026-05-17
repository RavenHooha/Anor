# Anor data & privacy contract

Anor collects location, presence, venue, and message data to power the consumer
experience. Some of that data may later be productised as **aggregate analytics
for venues**. This document defines the boundaries that productisation must
respect, so the rules are explicit before the dashboard exists rather than
retrofitted after a privacy incident.

This isn't a public legal document — it's an internal architectural contract.
The user-facing privacy policy will be derived from it.

## Principle

Raw user-level data never leaves Anor's servers. External products (venue
dashboards, partner integrations, exported reports) only ever see aggregates
computed under the rules below.

## Hard rules

These are enforced in code, not in marketing copy.

1. **Aggregates only.** Any external API (venue dashboard, partner export,
   public report) returns counts, percentages, distributions, or rates — never
   row-level data. There is no API surface that returns a list of `user_id`s
   or anything that reduces to one.

2. **K-anonymity threshold.** Any segment shown externally must contain ≥10
   distinct users. Smaller segments return `"insufficient data"`. Default
   threshold is 10; raise (never lower) per use case.

3. **Bucketing.**
   - Time → hour-of-day, day-of-week. Never raw timestamps.
   - Location → venue or neighborhood. Never raw coordinates.
   - Age → ranges (`18-24`, `25-34`, ...). Never exact age.

4. **Bounded correlation.** Aggregate queries combine at most N filter
   attributes (start with N=2, expand cautiously). Combining many narrow
   filters re-identifies individuals even with k≥10.

5. **Per-user opt-out.** Users can disable analytics inclusion via a settings
   toggle. Opted-out users' rows are excluded from every aggregate. Default
   stance (on vs off) is a product decision documented in the privacy policy;
   either way the toggle exists.

6. **Audit log.** Every external aggregate query is logged with: caller,
   venue, filters applied, returned `N`. Repeated probing of low-N segments
   is an abuse signal triggering review.

7. **Sale of identifiable data is forbidden.** "Identifiable" includes any
   join key that could be used externally to re-identify a user (raw
   `user_id`, raw email, raw device token). Aggregates that pass the rules
   above are not identifiable.

8. **Deletion is honored end-to-end.** If a user deletes their account, their
   `venue_checkins`, `presence`, and message rows are deleted. The aggregate
   numbers shipped to venues before deletion are not retroactively recomputed
   (impractical), but post-deletion aggregates exclude their data.

## Why these rules

- **Trust is the product.** Anor is a proximity app where strangers see each
  other in physical space. Users who discover their movements are being sold
  in any traceable form will churn faster than any analytics revenue can offset.
- **Regulatory floor.** GDPR (EU), CCPA (California), and emerging US state
  laws require aggregate-only / anonymised data handling for third-party
  sharing. These rules satisfy that floor with margin to spare.
- **Architectural firewall.** Easier to enforce a no-raw-data invariant in
  code than to negotiate exceptions per partner contract later. Every
  exception is a future leak.

## What this means for development

- The `venue_checkins` table stores raw rows — that is fine, they live
  internally. The mistake to avoid is building any external endpoint that
  returns them.
- Internal admin tools (analytics for Anor employees) may see raw data, but
  with access logged and reviewed.
- Any new feature touching user behaviour data must answer: "If this data
  ended up in an external dashboard, would the rules above still hold?"
  If not, redesign.

## Default stance (decided)

**Analytics participation is opt-IN.** New users have `analytics_opted_in =
false` by default and must explicitly enable analytics participation via
Settings before any of their venue check-ins are recorded.

Enforced at write-time, not just read-time: opted-out users' actions are
**never inserted into `venue_checkins`** in the first place. This is
stronger than filtering at aggregation time — there's no historical data
to leak if the database is breached or a future query is poorly scoped.

**Why opt-in over opt-out:**
- Most defensible globally — GDPR (EU) requires "freely given" consent,
  which is hard to argue when opt-out is buried in settings.
- Trust signal: users who see "Anor doesn't collect anything by default"
  trust the app more than ones who discover hidden data collection.
- Forces us to make participation worth doing, rather than relying on
  user inattention.

**Tradeoff accepted:** the dataset will be much smaller (probably 10-20%
participation without an incentive). That's a real revenue ceiling on
the future B2B venue analytics product. The bet is that a smaller but
honest dataset is worth more than a large but coerced one — both
ethically and legally.

## Open product decisions (not yet made)

- **What's the perk for opting in?** A "founding member" badge? Premium
  boost credit? Early access to new features? Without a perk, opt-in
  rates will be low. With a perk, we need to make sure the perk doesn't
  cross the line into "conditioning consent on a benefit" (which GDPR
  treats as not freely-given consent — the user must be able to access
  the core product equivalently whether they opt in or not).
- Whether to publish a transparency report (count of queries served per
  venue, etc.).
- Whether to expose a "Download my data" button (GDPR Article 20 — required
  before EU launch; nice-to-have elsewhere).
