# DREAM Long-Form Benchmark Index

This index declares the current manual gold-standard long-form prose evaluations used to calibrate RevisionGrade report quality.

These files are **manual gold-standard references**, not production-output claims. They define the target quality bar for long-form DREAM output: full-manuscript coverage, canonical 13-criteria scoring, WAVE-informed diagnosis, structural stack analysis where applicable, revision priority order, and releasability assessment.

## Canonical schema family

```yaml
benchmark-schema: dream-longform-v1
benchmark-role: gold-standard-long-form
criteria-spine: canonical-13
route: LONG_FORM
wave-applied: true
```

## Gold-standard long-form prose benchmarks

| Work | Canonical file | Output mode | Status | Notes |
|---|---|---|---|---|
| *Froggin Noggin* | [`froggin-noggin-dream.md`](./froggin-noggin-dream.md) | `multi_layer_long_form` | Canonical DREAM long-form | Already carries front matter and uses layered architecture, score grid, criterion analysis, revision plan, and releasability assessment. |
| *Let the River Decide* | [`let-the-river-decide-dream.md`](./let-the-river-decide-dream.md) | `multi_layer_long_form` | Canonical DREAM long-form | Matches the DREAM long-form shape in substance: metadata, executive verdict, structural stack, layer/voice map, arc map, score grid, criterion analysis, cultural/protocol audit, revision plan, and repo note. |
| *Cartel Babies* | [`cartel-babies-dream.md`](./cartel-babies-dream.md) | `multi_layer_long_form` | Canonical DREAM long-form; header normalization pending | Matches the DREAM long-form shape in substance: executive verdict, market/shelf positioning, structural stack, arc map, 13-criteria grid, criterion analysis, revision queues, closure/readiness assessment. Header/front-matter should be normalized when the large benchmark body is next edited. |

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
13. Repo note stating the file is a manual reference, not a production assertion.

## Normalization rule

The three prose gold standards belong to the same DREAM long-form benchmark family even if their historical markdown headers differ.

When any of the large benchmark bodies are edited, add or preserve this front matter at the top:

```yaml
---
benchmark-schema: dream-longform-v1
title: <work title> DREAM Long-Form Gold Standard Evaluation
manuscript: <source manuscript name>
author: <author>
scope: full-manuscript
route: LONG_FORM
output-mode: multi_layer_long_form
benchmark-role: gold-standard-long-form
criteria-spine: canonical-13
wave-applied: true
---
```

Do not weaken the underlying evaluation body while normalizing headers. Header normalization is metadata only.
