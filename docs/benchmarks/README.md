# Benchmarks — Gold-Standard Reference Evaluations

This directory holds manual gold-standard reference evaluations that define the **target quality bar** for RevisionGrade evaluation output.

RevisionGrade now distinguishes three product-facing evaluation modes:

| Mode | Route / output mode | Template |
|---|---|---|
| `short_form_evaluation` | `SHORT_FORM` | [`short-form-evaluation-template.md`](../templates/evaluation/short-form-evaluation-template.md) |
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
| *Cartel Babies* | [`cartel-babies-dream-longform-multilayer-gold-standard.md`](./cartel-babies-dream-longform-multilayer-gold-standard.md) | `long_form_multi_layer_evaluation` | `multi_layer_long_form` | Unified canonical DREAM long-form multi-layer gold standard |

These files belong to the DREAM governed-ledger benchmark family in substance even where older markdown headers differ. Future edits should normalize headers or addenda without weakening the underlying evaluation body.

---

## Retired benchmark references

Obsolete benchmark references must not remain active as tests, fixtures, product exemplars, release gates, or Story Ledger authority.

The active native Story Ledger / DREAM benchmark authorities are the three entries above plus the filled answer keys in [`story-ledger/`](./story-ledger/). New or replacement tests should use those files, with `Cartel Babies` as the primary required-gold Story Ledger exemplar when a single example is needed.

---

## The Gold Standard

**[`cartel-babies-dream-longform-multilayer-gold-standard.md`](./cartel-babies-dream-longform-multilayer-gold-standard.md)** + **[`story-ledger/IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md`](./story-ledger/IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md)** — *Cartel Babies* (Michael J. Meraw). Required-gold long-form multi-layer benchmark plus revised ten-layer Story Ledger answer key. Use this as the primary product exemplar for seed / Phase 1A Story Ledger testing because it combines dual-protagonist tracking, narrator attribution, identity transition, institutional rescue/protection, symbolic object lifecycles, cartel pressure systems, and explicit completion/failure conditions.

`Froggin Noggin` remains a required-gold DREAM benchmark, and `Let the River Decide` remains calibration-tier. When a single code or test example is needed, prefer `Cartel Babies`.

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
