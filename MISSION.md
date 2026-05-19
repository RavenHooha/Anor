# Anor Mission

_Last updated: 2026-05-19_

This document is the founder's commitment to what Anor exists for beyond
itself. It's load-bearing: every product decision, every monetization
choice, and every governance decision should be checkable against it.

## Why Anor exists

Anor helps people meet in physical space.

A growing share of the US population — over 650,000 people on any given
night — has no physical space of their own to come home to. Many more
are one paycheck from that line. The product Anor sells is the ability
to share a place with someone. The mission Anor funds is the creation
of places for people who don't have one.

Both halves of that sentence have to be true for Anor to be coherent.
Anor without the mission is another proximity app. The mission without
Anor is empty intent.

## The broader goal

Anor is also an attempt to demonstrate, by example, that **a real
business can be built and operated without the founder extracting
maximum personal wealth from it.** The American default for successful
companies is "founder gets rich; community gets crumbs (or worse)."
That default is a cultural choice, not a law of physics.

The goal is to shift that cultural default — not by lecturing, but by
proving the alternative works. Every visible company that runs a
foundation-owned, sufficiency-then-mission model (Newman's Own,
Patagonia under Chouinard, REI as a co-op, the Bosch foundation
ownership of Bosch Group) makes the next founder's version of this
decision easier. The proof compounds.

This is why the giving structure isn't ornamental and isn't optional.
The whole point is to be one more credible data point that this is
possible, sustainable, and not naive. **If Anor succeeds as a business
but the giving model fails or quietly gets watered down, Anor has
failed at its primary mission, regardless of revenue.** The opposite
isn't true: Anor failing as a business while the founder personally
takes care of the local community is still a personal good, but it's
not what this document is for.

Two practical implications:

1. **Transparency is part of the product.** The annual giving report,
   the salary cap methodology, the operating cost breakdown — all
   public, all in this repo. Cultural change requires visible proof,
   not just whispered intent.
2. **Replicability is part of the product.** This document, the
   structure, and (eventually) the foundation paperwork are open. Other
   founders are explicitly encouraged to copy the model. The win
   condition isn't Anor specifically — it's the model spreading.

## Our commitment

**100% of Anor's net profit goes to building or funding housing for
low-income and unhoused Americans.** The founder takes a salary, real
operating costs are paid, a defined reinvestment ceiling allows growth,
and everything left over goes to the mission.

This is the Newman's Own model: the founder takes compensation
comparable to a senior tech founder at a comparable-size company —
but capped, so even if Anor becomes massively successful the founder
never extracts the kind of wealth that a non-mission-driven version
of the same company would. Everything past the cap goes to housing.

Specifically:
- **Recipient(s):** Any housing-focused organization chosen via the
  annual review (see allocation rule below). The current default is
  Habitat for Humanity, with priority toward the chapter serving
  western North Carolina (currently Jackson County). As Anor's user
  base broadens, the list may grow to include other Habitat chapters
  in user-density regions, other established housing nonprofits, or
  (see Structure) an Anor-affiliated foundation that builds homes
  directly. The rule is "housing, local to our users" — not
  "wherever convenient."
- **Allocation rule:** A board-equivalent decision (founder + any
  partners) reviews the recipient annually. The 100% commitment cannot
  be lowered; the cap on reinvestment cannot be raised without a
  documented business reason and public disclosure.
- **Accountability:** Annual public report posted to `docs/giving/YYYY.md`
  in this repo with: total revenue, founder/employee compensation,
  operating costs, reinvestment, amount given, recipient organizations,
  receipts/acknowledgments. No discretionary exceptions.

## Why 100% (after sufficiency)

Three models were on the table:

- **% of revenue** (Patagonia, 1% for the Planet) — gives from day one.
  Punishing on thin margins. Capped giving by definition.
- **Modest % of net profit** (e.g. 5-10%, B Corp typical) — sustainable,
  conservative. Means the founder keeps most of the upside; the mission
  is a side project.
- **100% of net profit after defined sufficiency** (Newman's Own model;
  this choice) — maximum mission alignment. The company exists for the
  mission, not for the founder's wealth. Requires honest definitions of
  "sufficiency" so the model doesn't collapse into "I take everything
  as salary."

This is chosen because the mission *is* the reason Anor exists, and a
small % of profit treats the mission as a marketing line item. 100%
after sufficiency means every additional dollar of profit is a dollar
of housing — which makes growth itself the strategy. The founder is
incentivized to grow Anor not because growth = personal wealth, but
because growth = more housing.

The trade-off is **giving with this model is structurally incompatible
with venture capital.** VC investors require equity returns; "all
profit goes to charity" is not an investable thesis. This commits Anor
to a bootstrapped or revenue-based funding path. See [Structure](#structure).

## What "net profit" means here

To prevent the model from collapsing into the founder taking
everything as comp, "net profit" is defined as revenue minus the
following — each capped, each public:

> 1. **Founder compensation**, capped per the methodology below.
>    Sliding floor scales with profitability; hard ceiling is bounded.
>    Cap cannot be exceeded without a board-equivalent vote and public
>    disclosure in the annual giving report.
>
> 2. **Employee and contractor compensation**, at fair market rates per
>    role.
>
> 3. **Operating costs** — infrastructure (Supabase, EAS, hosting),
>    third-party services (push, content moderation, etc.), legal,
>    accounting, banking.
>
> 4. **Reinvestment for growth**, capped at 30% of pre-tax operating
>    income annually. Reinvestment buckets: product development,
>    marketing, geographic expansion, one-time infrastructure.
>
> 5. **Taxes** at the entity level.
>
> **Everything remaining is given.**

The 30% reinvestment cap is the critical guard against "we'll reinvest
this year and give later" indefinitely. There's always a temptation to
defer giving; the cap forces giving even during growth.

The founder salary cap is the second critical guard. Without it, the
model collapses into "I take everything as comp." With it, the founder
gets a real salary if Anor succeeds and a real-but-bounded salary if
Anor succeeds enormously — but never becomes wealthy in the sense that
tech founders typically do at scale.

## Founder salary cap methodology

The cap has two parts: a floor that scales with profitability and a
ceiling that's bounded regardless of company size.

**Hard ceiling: $250,000/year in 2026 dollars**, indexed annually to
the US Bureau of Labor Statistics CPI-U. (Without indexing, $250k in
2026 erodes to ~$150k purchasing power within 15 years; the indexing
preserves the real value.) The ceiling is a hard cap — no carve-outs,
no bonuses on top, no "founder fee" routed around it. When Anor's net
profit grows past the point where the floor formula would exceed
$250k, all the excess goes to housing instead of the founder.

**Sliding floor:** during the years before the ceiling is reached, the
founder's actual compensation is the lesser of:
- 5-8% of trailing-year net profit, or
- The hard ceiling above

In practice, this means:

| Anor net profit (annual) | Founder compensation | Going to housing |
|--------------------------|----------------------|------------------|
| $0-50k (scrappy survival) | $0-30k from savings or part-time work | Negligible |
| $100k | $5-8k | $92-95k |
| $500k | $25-40k | $460-475k |
| $1M | $50-80k | $920-950k |
| $5M | $250k (ceiling hits) | $4.75M |
| $20M | $250k (ceiling stays) | $19.75M |
| $50M | $250k (ceiling stays) | $49.75M |

The shape of this is honest: the founder takes a real salary if Anor
succeeds modestly, keeps that salary if Anor succeeds massively, but
never becomes wealthy in the conventional sense. At $20M revenue, a
typical tech founder would take home $3-5M+ per year through salary +
dividends + equity events. Under this cap, the founder takes $250k and
the other $19.75M goes to housing.

**Comparables.** $250k is roughly:
- 25-50% of what comparable VC-backed tech founders extract at this
  scale
- 50% of what the CEO of Habitat for Humanity International makes
- ~2x median household income in Jackson County, NC (where the
  founder lives), so it's comfortable but not extractive
- Indexed to inflation, so it remains a real salary over decades

**Revisions.** This cap and methodology can only be revised
**upward** (more constraint on founder, more to mission) without
public disclosure. Any change that increases founder take must be
disclosed in the annual giving report with a documented business
reason, and reverts automatically if not re-affirmed annually.

## Structure

For now, Anor is an LLC (single-member). The commitment in this document
is binding on the founder personally, and will be carried into any
successor entity.

**The end-state structure is foundation ownership** — the same
mechanism Newman's Own uses. The Anor operating company is owned by a
charitable foundation; the foundation directs 100% of net profits per
this document. This is the only structure that makes a 100%-after-
sufficiency commitment legally and tax-efficiently durable, because the
giving happens at the ownership level, not as a discretionary expense
each year.

Path to that end-state:
1. **Now (pre-revenue):** Single-member LLC. Commitment is binding on
   the founder personally per this document.
2. **First revenue + ~3 months runway:** Convert LLC to **North Carolina
   Public Benefit Corporation (PBC)** with this mission written into
   the articles of incorporation. PBC structure makes the commitment
   binding on future boards, not just current founder intent.
3. **Sustained profitability (~$100k+ annual giving):** Establish a
   charitable foundation and transfer ownership of the operating PBC
   to the foundation. From this point on, the giving is structural,
   not discretionary.

Once the foundation exists, it may operate either as a
**grant-making entity** (directing profits to Habitat and other
established housing nonprofits) or as a **direct operator** (the
foundation itself builds or funds the building of homes — e.g., a
tiny-house program in Jackson County). 100% of profits still flow
to housing either way; the choice is which path delivers more
housing per dollar at that stage, and is left to the foundation's
first year of operation rather than locked here.

**This path is incompatible with traditional venture capital.** VC
returns are paid via equity appreciation and eventual liquidity events.
A company owned by a charitable foundation cannot deliver either at
scale. If Anor needs outside capital, viable paths are:
- **Revenue-based financing** (RBF) — capital repaid as a % of revenue
  until a multiple is reached. Does not require equity.
- **Mission-aligned debt** (community lenders, CDFIs, mission-driven
  banks). Pays interest, no equity.
- **Strategic grants** from foundations interested in the housing
  outcome.

If a future scenario genuinely requires equity capital (e.g., capital-
intensive infrastructure), the founder will document the trade-off
publicly before accepting, and the giving floor cannot be lowered as
part of the deal.

B Corp certification is desirable but premature — it requires 12+
months of meaningful operations to audit. Targeted post-revenue.

## What this means for product decisions

When a product or monetization choice could go two ways, the tiebreaker
is **whichever way generates more sustainable revenue without
compromising user trust**, because revenue → profit → giving.

This rules out:
- Selling user data (kills trust; see PRIVACY.md).
- Dark-pattern monetization (paid-to-message, paywalls that block safety
  features, etc.).
- Vague subscription bundles where the user can't tell what they're
  paying for.

This rules in:
- Honest premium tier with clear value (extended radius, profile boosts,
  founding-member badge for analytics opt-in, etc.).
- B2B venue analytics dashboard, subject to PRIVACY.md's k-anonymity and
  bucketing rules.
- Local venue partnerships and curated date-night packages.

## When we'll start announcing this in-app

Not yet. The commitment is real and structural now (this doc is the
binding form), but in-app marketing of the mission waits until:

1. The first contribution has actually been made (even a small one).
2. The annual report exists at `docs/giving/2026.md` (or first year of
   revenue, whichever comes first).
3. The number being communicated to users is auditable.

This rule exists because "we will give" reads as marketing, and
"we have given $X to Y" reads as evidence. We earn the second framing
by doing the first.

A bare line like "Built in Sylva. A portion of our revenue funds local
housing." may appear earlier as a soft signal, but the specific %, the
recipient, and the dollar amount only appear in-app once there are
receipts to back them.

## Open questions

- **How exactly is the founder salary cap calibrated?** "Median of
  comparable founders" requires picking a data source (Pave, Levels.fyi,
  BLS, founder salary surveys). Picking the source should happen before
  the first salary is set, not after.
- **Should users be able to direct part of their subscription to a
  specific local org?** Considered "donor-advised giving" lite. Adds
  complexity, but increases user agency. Revisit post-paid-tier.
- **When does the foundation structure get set up?** The trigger of
  "sustained profitability + ~$100k annual giving" is rough. May want
  to set it up earlier if it would attract mission-aligned funding.
- **What happens if Anor is acquired?** The commitment is binding on
  successor entities per this document, but acquirers may resist.
  Pre-deal disclosure of this constraint is mandatory; any acquirer
  must explicitly agree to preserve the giving structure as a condition
  of sale.

## Disclaimer

This document is binding on the founder personally. It is not legal
financial advice and does not create a charitable trust under tax law.
When Anor reaches any of the milestones above (incorporation, outside
capital, first $50k of giving), consult an attorney to formalize the
structure appropriately.
