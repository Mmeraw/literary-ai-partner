# DREAM Long-Form Benchmark Index

This index declares the current manual gold-standard long-form prose evaluations used to calibrate RevisionGrade report quality.

These files are **manual gold-standard references**, not production-output claims. They define the target quality bar for long-form DREAM output: full-manuscript coverage, canonical 13-criteria scoring, WAVE-informed diagnosis, structural stack analysis where applicable, governed-ledger completeness, revision priority order, and releasability assessment.

## Canonical schema family

```yaml
benchmark-schema: dream-longform-v2-governed-ledgers
benchmark-role: gold-standard-long-form
criteria-spine: canonical-13
route: LONG_FORM
dream-template-version: pass3b-longform-v2-governed-ledgers
governed-ledgers: true
wave-applied: true
```

## Gold-standard long-form prose benchmarks

| Work | Preserved manual benchmark | V2 governed-ledger addendum | Output mode | Tier | Notes |
|---|---|---|---|---|---|
| *Froggin Noggin* | [`froggin-noggin-dream.md`](./froggin-noggin-dream.md) | [`froggin-noggin-dream-v2-governed-ledger-addendum.md`](./froggin-noggin-dream-v2-governed-ledger-addendum.md) | `multi_layer_long_form` | Required gold | Original body remains the manual reference; V2 addendum is the binding governed-ledger compliance layer. |
| *Cartel Babies* | [`cartel-babies-dream.md`](./cartel-babies-dream.md) | [`cartel-babies-dream-v2-governed-ledger-addendum.md`](./cartel-babies-dream-v2-governed-ledger-addendum.md) | `multi_layer_long_form` | Required gold | Original body remains preserved; V2 addendum supersedes unqualified integrity/coverage findings where DREAM v2 requires more precise classification. |
| *Let the River Decide* | [`let-the-river-decide-dream.md`](./let-the-river-decide-dream.md) | [`let-the-river-decide-dream-v2-governed-ledger-addendum.md`](./let-the-river-decide-dream-v2-governed-ledger-addendum.md) | `multi_layer_long_form` | Calibration | Calibration-tier governed-ledger example for eco-thriller / memoir-witness / cultural-protocol / research-heavy ambiguity behavior. |

## Public-domain calibration standards

Public-domain calibration files are teaching benchmarks only. They are useful for evaluator calibration, corpus testing, and public literary architecture references, but they are not RevisionGrade-native runtime authority.

| Benchmark | Author | File | Route | Tier | Runtime authority | Governed ledgers |
|---|---|---|---|---|---|---|
| *Dracula* | Bram Stoker | [`public-domain/dracula-dream-calibration.md`](./public-domain/dracula-dream-calibration.md) | `LONG_FORM` | public-domain-calibration | `false` | Yes |
| *Great Expectations* | Charles Dickens | [`public-domain/great-expectations-dream-calibration.md`](./public-domain/great-expectations-dream-calibration.md) | `LONG_FORM` | public-domain-calibration | `false` | Yes |

*Dracula* teaches form-as-plot detection, multi-voice evidence assembly, Mina as structural organizer, Gothic sensory governance, symbolic contagion systems, and the distinction between productive procedural realism and momentum drag. Required detection: epistolary architecture, evidence distribution across acts, character structural weight versus action weight, symbolic lifecycle tracing, and middle pacing drag as a named weakness.

*Great Expectations* teaches moral psychology as plot architecture, shame as an organizing system, false-causality revelation, Joe as quiet ethical ground, Magwitch as benefactor inversion, Satis House as wound-system, tactile moral register, and the difference between Dickensian social breadth and pacing drag.

## V2 governance rule

The preserved benchmark body and its V2 addendum must be read together:

```text
preserved manual benchmark body + V2 governed-ledger addendum = current DREAM benchmark contract
```

Do not rewrite the original benchmark bodies merely to conform to V2. The addenda are the normalization layer. They preserve historical/manual editorial judgment while making the benchmark comply with the current DREAM governed-ledger template.

Public-domain calibration follows the same governed-ledger shape but must remain `runtime-authority: false` unless explicitly promoted through a later governance decision.

## Required DREAM governed ledgers

A DREAM v2 long-form gold-standard benchmark must expose, directly or by addendum:

1. Character Coverage & Arc Ledger.
2. Relationship Spine Ledger.
3. Symbol-to-Character Payoff Ledger.
4. Sensory / Emotional Register Ledger.
5. Manuscript Integrity Confidence Table.
6. Evidence Distribution / Confidence Gate.

The ledger specs live at:

```text
docs/governance/dream-ledgers/
```

## Duplicate / legacy path note

`cartel-babies-dream-longform-evaluation.md` is a legacy/alternate Cartel Babies path. The canonical repo-facing benchmark path is:

```text
docs/benchmarks/cartel-babies-dream.md
```

Future edits should prefer the canonical path unless there is a deliberate migration or deletion task.

## Required DREAM long-form surfaces

A DREAM long-form gold-standard benchmark should expose, at minimum:

1. Work metadata / source manuscript metadata.
2. Route: `LONG_FORM`.
3. Output mode: usually `multi_layer_long_form` for these three gold standards.
4. Executive verdict.
5. Overall score or readiness score.
6. Full canonical 13-criteria score grid.
7. Criterion-by-criterion analysis for all 13 criteria.
8. Evidence-backed diagnosis.
9. WAVE-informed revision priorities.
10. Structural stack / layer analysis where manuscript architecture requires it.
11. Cross-layer or cross-criterion synthesis.
12. Releasability/readiness assessment.
13. DREAM governed-ledger addendum or equivalent folded ledger sections.
14. Repo note stating the file is a manual reference, not a production assertion.

## Normalization rule

The three prose gold standards belong to the same DREAM long-form benchmark family even if their historical markdown headers differ.

When any of the large benchmark bodies are edited, add or preserve this front matter at the top:

```yaml
---
benchmark-schema: dream-longform-v2-governed-ledgers
title: <work title> DREAM Long-Form Gold Standard Evaluation
manuscript: <source manuscript name>
author: <author>
scope: full-manuscript
route: LONG_FORM
output-mode: multi_layer_long_form
benchmark-role: gold-standard-long-form
criteria-spine: canonical-13
dream-template-version: pass3b-longform-v2-governed-ledgers
governed-ledgers: true
wave-applied: true
---
```

Do not weaken the underlying evaluation body while normalizing headers. Header normalization is metadata only. Addenda are the preferred V2 compliance layer for large manual benchmark bodies.
