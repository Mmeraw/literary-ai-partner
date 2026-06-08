# Recommendation Executability Standard

**Status:** Canonical governance standard
**Applies to:** Revise Queue, TrustedPath, Strategy Cards, withheld opportunities

## Core rule

Not every valid diagnosis is safely executable as manuscript prose.

A Revise recommendation may offer copy-paste prose only when RevisionGrade can preserve author voice, canon, context, and local execution with high confidence. Otherwise, it must become an editorial strategy card or be withheld.

This standard shifts the gate from vague confidence to safety and scope.

## Card taxonomy

### 1. Copy-Paste Rewrite Card

Use only when all of the following are true:

- passage is short or moderate
- evidence anchor is precise
- before/after context is sufficient
- no ledger or canon conflict is present
- voice fingerprint is stable
- operation is local
- at least 2 of 3 candidates pass quality
- candidate prose remains narratively safe

TrustedPath status: **Eligible**.

### 2. Revision Strategy Card

Use when the diagnosis is supported, but exact manuscript prose would be unsafe.

Triggers include:

- passage is long or multi-problem
- repair changes scene architecture
- repair affects POV, voice, canon, metaphor, or continuity
- downstream continuity may be affected
- candidate prose may pass grammar while failing narrative safety
- ledger conflict is possible

TrustedPath status: **Unavailable — author review required**.

### 3. Withheld Card

Use when RevisionGrade cannot responsibly advise the author.

Triggers include:

- evidence is weak or missing
- context is missing
- canon is unclear
- diagnosis is unsupported

TrustedPath status: **Impossible**.

Withheld cards must remain invisible to normal users. Admin may inspect retained withheld candidates only for QA, support, model optimization, or consented training workflows.

## Required Strategy Card structure

Every Strategy Card must include:

- Card Number
- Card Type
- TrustedPath Status
- Reason Copy-Paste Is Unsafe
- Ledger Reference
- Evidence Anchor
- A — Recommended Repair
- B — Rhythm / Cadence Alternative
- C — Bold Structural Choice
- Author Decision Required

## Strategy Card prompt rules

When generating a Strategy Card:

- Do not generate manuscript prose.
- Do not imitate the author’s voice.
- Do not invent new facts.
- Do not alter canon.
- Provide editorial instructions only.

## Product promise

RevisionGrade must never fill the Revise Queue with fake prose.

Priority order:

1. Generate excellent copy-paste A/B/C when safe.
2. If not safe, generate A/B/C strategy approaches.
3. If strategy is unsupported, withhold the card.

Editorial honesty is a premium feature, not a downgrade.
