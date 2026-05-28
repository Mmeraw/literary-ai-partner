# DREAM Long-Form Multi-Layer Benchmark Index

This index declares the current manual gold-standard **long-form multi-layer** prose evaluations used to calibrate RevisionGrade report quality.

These files are **manual gold-standard references**, not production-output claims. They define the target quality bar for DREAM / long-form multi-layer output: full-manuscript coverage, canonical 13-criteria scoring, WAVE-informed diagnosis in plain editorial language, structural stack analysis where applicable, governed-ledger completeness, six-part criterion opportunities, revision priority order, and releasability assessment.

The controlling product-mode contract is:

```text
docs/governance/evaluation-output-mode-contract.md
```

The product-facing template is:

```text
docs/templates/evaluation/long-form-multi-layer-evaluation-template.md
```

Existing DREAM specifications and governed-ledger templates remain authoritative for detailed completeness rules. This index labels the benchmark family as `long_form_multi_layer_evaluation` so it is not confused with standard long-form or short-form output.

## Canonical schema family

```yaml
benchmark-schema: dream-longform-v2-governed-ledgers
evaluation-mode: long_form_multi_layer_evaluation
benchmark-role: gold-standard-long-form-multi-layer
criteria-spine: canonical-13
route: LONG_FORM
output-mode: multi_layer_long_form
dream-template-version: pass3b-longform-v2-governed-ledgers
governed-ledgers: true
wave-applied: true
```

## Gold-standard long-form multi-layer prose benchmarks

| Work | Preserved manual benchmark | V2 governed-ledger addendum | Evaluation mode | Output mode | Tier | Notes |
|---|---|---|---|---|---|---|
| *Froggin Noggin* | [`froggin-noggin-dream.md`](./froggin-noggin-dream.md) | [`froggin-noggin-dream-v2-governed-ledger-addendum.md`](./froggin-noggin-dream-v2-governed-ledger-addendum.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Required gold | Original body remains the manual reference; V2 addendum is the binding governed-ledger compliance layer. |
| *Cartel Babies* | [`cartel-babies-dream.md`](./cartel-babies-dream.md) | [`cartel-babies-dream-v2-governed-ledger-addendum.md`](./cartel-babies-dream-v2-governed-ledger-addendum.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Required gold | Original body remains preserved; V2 addendum supersedes unqualified integrity/coverage findings where DREAM v2 requires more precise classification. |
| *Let the River Decide* | [`let-the-river-decide-dream.md`](./let-the-river-decide-dream.md) | [`let-the-river-decide-dream-v2-governed-ledger-addendum.md`](./let-the-river-decide-dream-v2-governed-ledger-addendum.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Calibration | Calibration-tier governed-ledger example for eco-thriller / memoir-witness / cultural-protocol / research-heavy ambiguity behavior. |

## Public-domain calibration standards

Public-domain calibration files are teaching benchmarks only. They are useful for evaluator calibration, corpus testing, and public literary architecture references, but they are not RevisionGrade-native runtime authority.

| Benchmark | Author | File | Route | Suggested evaluation mode | Tier | Runtime authority | Governed ledgers |
|---|---|---|---|---|---|---|---|
| *Dracula* | Bram Stoker | [`public-domain/dracula-dream-calibration.md`](./public-domain/dracula-dream-calibration.md) | `LONG_FORM` | `long_form_multi_layer_evaluation` | public-domain-calibration | `false` | Yes |
| *Great Expectations* | Charles Dickens | [`public-domain/great-expectations-dream-calibration.md`](./public-domain/great-expectations-dream-calibration.md) | `LONG_FORM` | `long_form_multi_layer_evaluation` | public-domain-calibration | `false` | Yes |
| *Pride and Prejudice* | Jane Austen | [`public-domain/pride-and-prejudice-dream-calibration.md`](./public-domain/pride-and-prejudice-dream-calibration.md) | `LONG_FORM` | `long_form_evaluation` or `long_form_multi_layer_evaluation` depending calibration depth | public-domain-calibration | `false` | Yes |
| *The Awakening* | Kate Chopin | [`public-domain/the-awakening-dream-calibration.md`](./public-domain/the-awakening-dream-calibration.md) | `LONG_FORM` | `long_form_evaluation` | public-domain-calibration | `false` | No by default |

*Dracula* teaches form-as-plot detection, multi-voice evidence assembly, Mina as structural organizer, Gothic sensory governance, symbolic contagion systems, and the distinction between productive procedural realism and momentum drag. Required detection: epistolary architecture, evidence distribution across acts, character structural weight versus action weight, symbolic lifecycle tracing, and middle pacing drag as a named weakness.

*Great Expectations* teaches moral psychology as plot architecture, shame as an organizing system, false-causality revelation, Joe as quiet ethical ground, Magwitch as benefactor inversion, Satis House as wound-system, tactile moral register, and the difference between Dickensian social breadth and pacing drag.

*Pride and Prejudice* teaches social-pressure plotting as a structural engine, irony as simultaneous prose texture and plot mechanism, dialogue that advances plot / reveals character / signals class position in a single exchange, romantic comedy pacing as governed delay (earned withholding versus stall), the distinction between wit and sentimentality as register choices, and how a manuscript can be emotionally high-stakes while tonally light. Required detection: delayed-revelation romance architecture, comedy-of-manners as moral diagnostic, economic precarity as permanent background pressure, and the difference between Darcy's arc (social humiliation → genuine revision) and Wickham's arc (charm as weaponized surface with no interiority).

*The Awakening* teaches interiority as plot pressure, social constraint as antagonistic force, gendered expectation, symbolic environment, sensual register, and ambiguous closure. Required detection: quiet external action can still carry strong narrative drive when interior change, social role pressure, and symbolic recurrence escalate. It must not be used as a modern commercial pacing baseline or as a demand that literary interiority become external incident.

## V2 governance rule

The preserved benchmark body and its V2 addendum must be read together:

```text
preserved manual benchmark body + V2 governed-ledger addendum = current DREAM benchmark contract
```

Do not rewrite the original benchmark bodies merely to conform to V2 or to the new product-facing mode labels. The addenda are the normalization layer. They preserve historical/manual editorial judgment while making the benchmark comply with the current DREAM governed-ledger template.

Public-domain calibration follows the same governed-ledger shape where applicable but must remain `runtime-authority: false` unless explicitly promoted through a later governance decision. *The Awakening* is currently standard long-form calibration, not governed-ledger authority.

## Required DREAM governed ledgers

A DREAM v2 long-form multi-layer gold-standard benchmark must expose, directly or by addendum:

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

## Six-part criterion opportunity requirement

When a benchmark includes criterion-level repair targets or opportunities, the target structure is:

1. Evidence.
2. Symptom.
3. Cause.
4. Fix direction.
5. Reader effect.
6. Mistake-proofing.

Top Recommendations remain summary-level and should not be verbatim copies of criterion opportunities. A/B/C repair options belong in Revise Queue examples or Revise execution artifacts, not in evaluation benchmark output.

## Duplicate / legacy path note

`cartel-babies-dream-longform-evaluation.md` is a legacy/alternate Cartel Babies path. The canonical repo-facing benchmark path is:

```text
docs/benchmarks/cartel-babies-dream.md
```

Future edits should prefer the canonical path unless there is a deliberate migration or deletion task.

## Required DREAM long-form multi-layer surfaces

A DREAM long-form multi-layer gold-standard benchmark should expose, at minimum:

1. Work metadata / source manuscript metadata.
2. Route: `LONG_FORM`.
3. Evaluation mode: `long_form_multi_layer_evaluation`.
4. Output mode: `multi_layer_long_form`.
5. Executive verdict.
6. Overall score or readiness score.
7. Full canonical 13-criteria score grid.
8. Criterion-by-criterion analysis for all 13 criteria.
9. Evidence-backed diagnosis.
10. Six-part criterion opportunities where material.
11. WAVE-informed revision priorities in plain editorial language.
12. Structural stack / layer analysis where manuscript architecture requires it.
13. Cross-layer or cross-criterion synthesis.
14. Releasability/readiness assessment.
15. DREAM governed-ledger addendum or equivalent folded ledger sections.
16. Repo note stating the file is a manual reference, not a production assertion.

## Normalization rule

The three native prose gold standards belong to the same DREAM long-form multi-layer benchmark family even if their historical markdown headers differ.

When any of the large benchmark bodies are edited, add or preserve this front matter at the top:

```yaml
---
benchmark-schema: dream-longform-v2-governed-ledgers
evaluation-mode: long_form_multi_layer_evaluation
title: <work title> DREAM Long-Form Multi-Layer Gold Standard Evaluation
manuscript: <source manuscript name>
author: <author>
scope: full-manuscript
route: LONG_FORM
output-mode: multi_layer_long_form
benchmark-role: gold-standard-long-form-multi-layer
criteria-spine: canonical-13
dream-template-version: pass3b-longform-v2-governed-ledgers
governed-ledgers: true
wave-applied: true
---
```

Do not weaken the underlying evaluation body while normalizing headers. Header normalization is metadata only. Addenda are the preferred V2 compliance layer for large manual benchmark bodies.
