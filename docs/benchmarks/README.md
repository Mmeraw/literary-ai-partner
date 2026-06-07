# Benchmarks — Gold-Standard Reference Evaluations

This directory holds manual gold-standard reference evaluations that define the **target quality bar** for RevisionGrade evaluation output.

RevisionGrade now distinguishes three product-facing evaluation modes:

| Mode | Route / output mode | Template |
|---|---|---|
| `short_form_evaluation` | `SHORT_FORM` | [`short-form-evaluation-template.md`](../templates/evaluation/short-form-evaluation-template.md) |
| `long_form_evaluation` | `LONG_FORM` / `standard_long_form` | [`long-form-evaluation-template.md`](../templates/evaluation/long-form-evaluation-template.md) |
| `long_form_multi_layer_evaluation` | `LONG_FORM` / `multi_layer_long_form` | [`long-form-multi-layer-evaluation-template.md`](../templates/evaluation/long-form-multi-layer-evaluation-template.md) |

The controlling mode contract is:

**[`docs/governance/evaluation-output-mode-contract.md`](../governance/evaluation-output-mode-contract.md)**

Existing DREAM long-form specifications and governed-ledger templates remain authoritative for detailed DREAM / Story Ledger / governed-ledger completeness rules. The new mode templates clarify product-facing report shape and scope; they do not replace DREAM canon.

---

## Native long-form multi-layer gold standards

The canonical DREAM long-form benchmark index is:

**[`DREAM_LONGFORM_BENCHMARK_INDEX.md`](./DREAM_LONGFORM_BENCHMARK_INDEX.md)**

That index declares the three current RevisionGrade-native prose gold standards as **long-form multi-layer evaluation** benchmarks:

| Work | File | Evaluation mode | Output mode | Role |
|---|---|---|---|---|
| *Froggin Noggin* | [`froggin-noggin-dream.md`](./froggin-noggin-dream.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Manual DREAM long-form multi-layer gold standard |
| *Let the River Decide* | [`let-the-river-decide-dream.md`](./let-the-river-decide-dream.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Manual DREAM long-form multi-layer calibration standard |
| *Cartel Babies* | [`cartel-babies-dream.md`](./cartel-babies-dream.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Manual DREAM long-form multi-layer gold standard |

These files belong to the DREAM governed-ledger benchmark family in substance even where older markdown headers differ. Future edits should normalize headers or addenda without weakening the underlying evaluation body.

---

## Legacy / historical reference files

Some benchmark-adjacent files are preserved because they teach a regression lesson, but they are **not current production-output authority**.

Legacy reference files may be used to preserve lessons such as canon continuity, missing-evidence handling, or craft-vs-intelligence separation. They must not override the canonical 13-criterion registry, the current scope policy, or the product-facing templates.

Current examples:

| File | Legacy status | Allowed use | Not allowed to do |
|---|---|---|---|
| [`ancient-bloodlines-shortform-model.md`](./ancient-bloodlines-shortform-model.md) | Preserved `EvaluationReportV1` / 12-criterion historical short-form model | Teach canon continuity, missing-evidence handling, and craft-vs-intelligence separation | Claim current 13-criterion production shape |
| [`../testdata/evaluation/ancient-bloodlines.shortform.model.json`](../testdata/evaluation/ancient-bloodlines.shortform.model.json) | Preserved fixture backing legacy tests | Drive explicit legacy-reference guards only | Serve as a current scoring fixture, benchmark gate, release gate, or Story Ledger authority |
| [`ancient-bloodlines-longform-layered-template.md`](./ancient-bloodlines-longform-layered-template.md) | Historical path for a blank multi-layer format template | Backward-compatible reference only | Replace `docs/templates/evaluation/long-form-multi-layer-evaluation-template.md` as product template authority |

Legacy tests must say so in their header. They should verify that preserved files remain useful **and** that they do not masquerade as current mode/template authority.

---

## The Gold Standard

**[`froggin-noggin-dream.md`](./froggin-noggin-dream.md)** — *Froggin Noggin* (Michael J. Me Raw). Full long-form multi-layer gold-standard evaluation: 13-criteria score grid, layered architecture analysis, canon/doctrine audit, revision plan, releasability assessment, and DREAM governed-ledger expectations where applicable. This is a calibration target — when production output disputes a criterion or long-form diagnosis, this file helps determine which side is closer to ground truth.

Schema family: `canonical-13` / `dream-longform-v2-governed-ledgers` / `long_form_multi_layer_evaluation` where front matter and index opt in. Shape validation is handled by `tests/evaluation/benchmarks/gold-standard-shape.test.ts` where applicable.

---

## What gold-standard files are for

- **Calibration target.** They define the target editorial depth for each mode.
- **Quality bar.** Pass 1 / Pass 2 / Pass 3 prompt and schema work should converge primary-evaluator output toward this depth, format, and rigor where the selected mode requires it.
- **Documentation.** They capture structural, thematic, architectural, and readiness analysis in a form that survives prompt churn.
- **Mode clarity.** They prevent short-form, standard long-form, and long-form multi-layer outputs from being treated as interchangeable.

---

## What gold-standard files are NOT

- **Not test fixtures.** No production assertion compares live output to these scores or text. Shape smoke tests validate structural conformance, not scoring outcomes.
- **Not a claim of current capability.** The repo note in each file states this explicitly where needed.
- **Not versioned generated output.** They are human-authored reference documents that anchor calibration over time.
- **Not a reason to overpromise.** A short-form report must not imply the depth of a long-form multi-layer benchmark.
- **Not legacy override authority.** Historical reference files must never silently replace the current canonical mode, scope, template, or 13-criterion contracts.

---

## Adding a new gold-standard benchmark

New gold-standard files MUST identify the evaluation mode they represent and must use the canonical 13 criterion names the production pipeline emits, so the benchmark stays comparable to live output across prompt changes.

1. Place the file at `docs/benchmarks/<work-slug>.md`.
2. Add YAML front matter at the very top.

For short-form benchmarks:

```yaml
---
benchmark-schema: short-form-evaluation-v1
evaluation-mode: short_form_evaluation
benchmark-role: gold-standard-short-form
criteria-spine: canonical-13
route: SHORT_FORM
output-mode: short_form_evaluation
wave-applied: false
---
```

For standard long-form benchmarks:

```yaml
---
benchmark-schema: long-form-evaluation-v1
evaluation-mode: long_form_evaluation
benchmark-role: gold-standard-long-form
criteria-spine: canonical-13
route: LONG_FORM
output-mode: standard_long_form
wave-applied: true
---
```

For long-form multi-layer / DREAM governed-ledger benchmarks:

```yaml
---
benchmark-schema: dream-longform-v2-governed-ledgers
evaluation-mode: long_form_multi_layer_evaluation
benchmark-role: gold-standard-long-form-multi-layer
criteria-spine: canonical-13
route: LONG_FORM
output-mode: multi_layer_long_form
dream-template-version: pass3b-longform-v2-governed-ledgers
governed-ledgers: true
wave-applied: true
---
```

3. Include a score-grid table with rows for all 13 canonical criteria using the production names exactly as defined in `schemas/criteria-keys.ts` (`CRITERIA_METADATA`):
   - Concept & Core Premise
   - Narrative Drive & Momentum
   - Character Depth & Psychological Coherence
   - Point of View & Voice Control
   - Scene Construction & Function
   - Dialogue Authenticity & Subtext
   - Thematic Integration
   - World-Building & Environmental Logic
   - Pacing & Structural Balance
   - Prose Control & Line-Level Craft
   - Tonal Authority & Consistency
   - Narrative Closure & Promises Kept
   - Professional Readiness & Market Positioning

4. Criterion opportunities should follow the six-part diagnostic contract when present:
   - Evidence
   - Symptom
   - Cause
   - Fix direction
   - Reader effect
   - Mistake-proofing

5. Score column uses the format `N.N / 10` or `N / 10` (bold optional).
6. Confidence column uses one of: High, Moderate-High, Moderate, Moderate-Low, Low.
7. Include a disclaimer (Repo note or equivalent) stating this is a manual reference, not a production assertion.
8. The smoke test at [`tests/evaluation/benchmarks/gold-standard-shape.test.ts`](../../tests/evaluation/benchmarks/gold-standard-shape.test.ts) automatically validates files with recognized benchmark front matter and ignores everything else.

---

## Normalization rule

Do not rewrite preserved manual benchmark bodies merely to conform to the new mode labels. Use front matter, addenda, template notes, and benchmark index metadata unless the benchmark itself is intentionally being regenerated.

Historical fixtures may remain in the repo only when they are clearly labeled as legacy references and covered by tests that prevent them from being mistaken for current production-output authority.
