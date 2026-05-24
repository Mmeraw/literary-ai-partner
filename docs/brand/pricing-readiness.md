# RevisionGrade™ Pricing Readiness Doctrine

## Canonical pricing principle

RevisionGrade uses a fixed-price audit and metered repair model.

> The audit reveals the manuscript’s readiness profile. Editorial Actions unlock and repair specific opportunities.

This separates bounded diagnosis from variable-cost revision execution.

## Pricing ladder

| Audit Tier | Manuscript Word Count | Editorial Actions Included | Price | Best For |
| --- | ---: | ---: | ---: | --- |
| Free Opening Diagnostic | Up to 3,000 words | 0 | $0 | Testing hook, voice, and narrative pressure. |
| Short-Form Evaluation | Up to 24,999 words | 5 | $49 | Novellas, short stories, and early concept tests. |
| Full Manuscript Readiness Audit | 25,000–120,000 words | 25 | $249 | The Professional Standard; includes WAVE Revision System™. |
| Long Manuscript Readiness Audit | 120,001–180,000 words | 50 | $399 | Epic-scale manuscripts and longer novels. |
| Complex Narrative Audit | 180,001+ words | 100 | $499+ | Multi-layer, transmedia, or franchise-scale work. |

## Editorial Action packs

| Pack | Editorial Actions | Price |
| --- | ---: | ---: |
| Starter Pack | 25 | $29 |
| Professional Pack | 100 | $89 |
| Studio Pack | 300 | $199 |

## Golden Spine™ threshold

The Golden Spine™ threshold begins at 25,000 words.

Below 25,000 words, a work is evaluated through the 13 Story Criteria.

At 25,000 words and above, long-range structure, pacing, character continuity, payoff, and cumulative reader experience require the WAVE Revision System™.

## Editorial Actions doctrine

Editorial Actions are not tokens and should not be described as tokens.

An Editorial Action unlocks and repairs a specific revision opportunity.

At launch, one Editorial Action should represent:

- unlock one Granular Opportunity Card
- return the full evidence and diagnosis for that opportunity
- generate one governed repair proposal or rewrite pathway

The user should always receive a readiness diagnosis and opportunity summary from a paid audit. The full repair blueprint is not given away in bulk.

## Audit versus repair

The fixed-price audit includes:

- readiness verdict
- criteria or WAVE results as applicable
- strengths and priority signals
- opportunity count
- severity distribution
- top systemic readiness risks
- recommended editorial path

Editorial Actions unlock:

- specific evidence
- specific passage reference where applicable
- cause
- reader effect
- fix direction
- governed repair proposal
- dialogue patch, scene repair, continuity-safe alternative, or validation pass where applicable

## No unlimited revision

Unlimited revision is not allowed in the RevisionGrade pricing doctrine.

Revision is variable. Some manuscripts need only a few targeted refinements. Others benefit from deeper staged repair. Unlimited revision pricing would dilute the audit standard and encourage low-value generation instead of focused, high-impact revision work.

## Action lifecycle doctrine

Included Editorial Actions are project-bound.

Purchased Editorial Action packs are account-level.

Recommended future implementation rule:

- Included actions expire after 12 months.
- Purchased actions expire after 24 months unless local law requires otherwise.
- Used actions are not refundable when the generation succeeds and the user receives the unlocked opportunity or proposal.
- Failed generations should be represented as ledger reversal/refund events, not as a user-callable refund endpoint.

## Upgrade policy doctrine

Free Opening Diagnostic purchases create no cash credit.

Paid lower-tier audits may be credited toward a higher-tier audit for the same project/manuscript lineage within 30 days.

Recommended examples:

- Short-Form Evaluation to Full Manuscript Readiness Audit: $49 credit toward $249.
- Full Manuscript Readiness Audit to Long Manuscript Readiness Audit: $249 credit toward $399 when the manuscript crosses the tier before or shortly after purchase.

A substantially expanded manuscript should usually require a new audit or discounted re-audit rather than a simple upgrade.

Major expansion indicators include:

- more than 15–20% word-count growth
- new POV architecture
- new ending
- new major subplot
- new genre/category positioning

## Future ledger implementation

The pricing page is declarative only. It does not implement payments, ledger enforcement, or unlock behavior.

Future backend enforcement should use a transactional unlock route:

```txt
POST /opportunities/:id/unlock
```

Read-only details should remain read-only:

```txt
GET /opportunity-details/:id
```

The unlock operation must be intentional, idempotent, auditable, and protected from accidental GET requests, browser prefetching, duplicate clicks, or bots.

Recommended future records:

- `editorial_action_ledger`
- `opportunity_unlocks`
- `audit_upgrades`

Recommended invariant:

- already unlocked opportunity returns existing details and does not debit again
- not unlocked opportunity debits once, generates once, persists once

## Public pricing copy

A Note on Editorial Readiness:

RevisionGrade™ is not a writing tool. It is an editorial audit system.

Each paid audit provides a structural diagnosis of your manuscript’s readiness: where the story is already working, where readiness can be improved, and what kind of editorial support may help next.

Granular Opportunity Cards and governed repair proposals are unlocked through Editorial Actions included with your audit or available in packs.

Before you pay for polish, diagnose readiness.
