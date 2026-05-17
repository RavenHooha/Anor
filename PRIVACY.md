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

## Open product decisions (not yet made)

- Default opt-in vs opt-out for analytics inclusion.
- Whether to offer a paid consumer tier that includes "exclude my data from
  all aggregates" as a perk.
- Whether to publish a transparency report (count of queries served per
  venue, etc).
