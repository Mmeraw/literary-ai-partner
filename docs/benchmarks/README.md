# Benchmarks — Gold-Standard Reference Evaluations

This directory holds manual gold-standard reference evaluations that define the **target quality bar** for RevisionGrade long-form output.

## The Gold Standard

**[`froggin-noggin-dream.md`](./froggin-noggin-dream.md)** — *Froggin Noggin* (Michael J. Me Raw). Full long-form gold-standard evaluation: 13-criteria score grid, layered architecture analysis, canon/doctrine audit, revision plan, releasability assessment. This is THE calibration target — when a production evaluation disputes a criterion against the Pass 4 cross-checker, this file is the reference for which side is closer to ground truth.

Schema: `canonical-13-v1` (front-matter opt-in; validated by `tests/evaluation/benchmarks/gold-standard-shape.test.ts`).

## What gold-standard files are for

- **Calibration target.** Pass 4 disputes resolve against the gold standard — this is the ground truth we tune toward.
- **Quality bar.** Pass 1 / Pass 2 / Pass 3 prompt and schema work should converge primary-evaluator output toward this depth, format, and rigor.
- **Documentation.** Captures the kind of structural, thematic, and architectural analysis the platform aspires to produce, in a form that survives prompt churn.

## What gold-standard files are NOT

- **Not test fixtures.** No production assertion compares live output to these scores or text. The shape smoke test only validates structural conformance, not scoring outcomes.
- **Not a claim of current capability.** The repo note in each file states this explicitly.
- **Not versioned with the schema.** They are human-authored reference documents that anchor calibration over time.

## Adding a new gold-standard benchmark

New gold-standard files MUST opt in to the **canonical-13-v1** schema. This binds the file to the same 13 criterion names the production pipeline emits, so the benchmark stays comparable to live output across prompt changes.

1. Place the file at `docs/benchmarks/<work-slug>.md`.
2. Add YAML front-matter at the very top:
   ```yaml
   ---
   benchmark-schema: canonical-13-v1
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

   Layered architecture rows beyond the 13 are allowed.
4. Score column uses the format `N.N / 10` (bold optional).
5. Confidence column uses one of: High, Moderate-High, Moderate, Moderate-Low, Low.
6. Include a disclaimer (Repo note or equivalent) stating this is a manual reference, not a production assertion.
7. The smoke test at [`tests/evaluation/benchmarks/gold-standard-shape.test.ts`](../../tests/evaluation/benchmarks/gold-standard-shape.test.ts) automatically validates files with the canonical-13-v1 front-matter and ignores everything else.

## Legacy reference material

Older reference material for *Ancient Bloodlines* — predates the canonical-13 schema and uses short-label conventions (`Theme / Intelligence`, `POV, Voice & Tone`, etc.). Retained for historical context only; not used as the primary calibration target. See [`ancient-bloodlines-README.md`](./ancient-bloodlines-README.md) for the full ancient-bloodlines package documentation.
