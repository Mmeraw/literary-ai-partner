# Long-Form Pipeline Success Contract

Status: Canonical runtime success contract for long-form and long-form multi-layer evaluations.
Authority: This document defines what "success" means for a long-form pipeline run. Tier 2 stress assertions, fail-closed codes, and pipeline-health diagnostics must map to clauses defined here.
Companion docs:
- `docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md` (report payload contract)
- `docs/governance/DREAM_OUTPUT_SPEC.md` (output canon)
- `docs/WAVE_REVISION_GUIDE_CANON.md` (WAVE canon)
- `docs/canon/registered/volumes/VOLUME-II-STORY-EVALUATION-CRITERIA.md` (13 criteria)

## Purpose

A long-form pipeline run is **only** successful when every clause below holds. A timeout that produces no scores and no summaries is **not** a success, regardless of partial work performed.

This contract exists to end the "dispatch, fail, diagnose, patch, dispatch again" loop by giving every failure a named clause.

## Scope

Applies to:
- standard long-form evaluations
- long-form multi-layer / multi-voice evaluations

Does not apply to:
- short-form evaluations (governed separately)
- admin-only diagnostic runs
- harness smoke tests

## The 15 Clauses

### Clause 1 — Routing engaged

The pipeline must materialize a chunked long-form substrate before invoking `runPipeline()`.

In harnesses this may be `chunkManuscript()`. In production this may be the canonical chunk materialization path, such as `ensureChunks()` or its successor. The invariant is that `runPipeline()` must not receive long-form input without `manuscriptChunks` or an equivalent persisted chunk substrate.

- Fail code: `CHUNK_ROUTING_NOT_ENGAGED`
- No silent fallback to `direct_window` is permitted for long-form input.

### Clause 2 — Chunk coverage sufficient

Coverage of analyzed words / total words must meet the configured long-form threshold.

- Fail code: `COVERAGE_INSUFFICIENT`
- The contract field `coverage_pct` must be persisted on every job.
- Manuscript-wide certification is forbidden when coverage is below threshold.

### Clause 3 — Pass 1 completes within budget

Pass 1 must complete for every chunk (or fail explicitly) within the configured Pass 1 wall-clock budget.

- Fail code: `PASS1_TIMEOUT`
- `pass1_ms` must be persisted per chunk and per job.

### Clause 4 — Pass 2 completes within budget

Pass 2 must complete for every chunk (or fail explicitly) within the configured Pass 2 wall-clock budget.

- Fail code: `PASS2_TIMEOUT`
- `pass2_ms` must be persisted per chunk and per job.

### Clause 5 — Pass 3 completes within budget

Pass 3 (synthesis) must complete within the configured Pass 3 wall-clock budget.

- Fail code: `PASS3_TIMEOUT`

### Clause 6 — Pass 4 governance present (required mode)

For jobs in required mode, Pass 4 governance evidence must be persisted.

- Fail code: `PASS4_MISSING`
- `pass4_governance` must be non-null.
- The UI must render missing Pass 4 evidence as missing evidence, never as zombie/heartbeat fiction.

### Clause 7 — Cross-check present (required mode)

For jobs in required mode, cross-check evidence must be persisted.

- Fail code: `CROSS_CHECK_MISSING`
- `cross_check` must be non-empty.

### Clause 8 — Quality gate passes

The quality gate must pass. Independence, weak-summary propagation, and score/confidence consistency must all hold.

- Fail code: `QG_FAILED`
- Specific sub-causes must be recorded in `quality_gate_failure_reason`.

### Clause 9 — Scores produced

The job must produce numeric scores for the 13 Story Criteria (Volume II).

- Fail code: `SCORES_MISSING`
- A timeout that prevents score production is a Clause 9 failure, not "partial success."

### Clause 10 — Summaries produced

The job must produce per-criterion summaries and a manuscript-level summary.

- Fail code: `SUMMARIES_MISSING`

### Clause 11 — Total runtime within budget

Total wall-clock runtime must be under the configured total budget.

- Fail code: `TOTAL_TIMEOUT`
- `total_ms` must be persisted.

### Clause 12 — Persistence complete

All required fields above must be persisted to the evaluation result store before the job is marked `complete`.

- Fail code: `PERSISTENCE_INCOMPLETE`
- `status = complete` is forbidden when any required field is null in required mode.

### Clause 13 — DREAM document produced (LONG_FORM route)

For jobs on the `LONG_FORM` route, Pass 3b must produce a `longform_document` artifact. A job that produces scores and summaries via short-path synthesis but no `longform_document` artifact is a Clause 13 failure.

- Fail code: `LONGFORM_DOCUMENT_MISSING`
- `longform_document` must be non-null and persisted on every LONG_FORM job.
- The UI must not present a long-form result as complete when `longform_document` is absent.

### Clause 14 — DREAM document sections complete

The `longform_document` produced by Clause 13 must contain all 16 required sections as defined in `docs/governance/DREAM_STATE_LONGFORM_CANON.md`.

- Fail code: `LONGFORM_SECTIONS_INCOMPLETE`
- All 13 canonical criteria must be scored or truthfully caveated in the document.
- Criterion names 12 and 13 must be `Narrative Closure & Promises Kept` and `Professional Readiness & Market Positioning` respectively.
- The section count must equal 16 (Sections 1–16 in canonical order).

### Clause 15 — Multi-layer score rows present (multi_layer_long_form)

For jobs producing `output_mode = multi_layer_long_form`, the score grid in the DREAM document must include the 4 architecture rows after criterion 13:
- Layer & Mode Integration
- Layer Coherence
- Doctrine / Symbolic System Integrity
- Canon & Continuity Integrity

- Fail code: `MULTILAYER_ROWS_MISSING`
- These rows must be present and scored (or truthfully caveated) when output mode is `multi_layer_long_form`.
- Absence of these rows when mode is `multi_layer_long_form` is a Clause 15 failure.

## Multi-layer addendum

For long-form multi-layer / multi-voice runs, every layer must independently satisfy Clauses 1–12. A layer failure is a job failure. No layer may be silently dropped.

- Fail code: `LAYER_INCOMPLETE`
- `layers[].status` must be persisted for each layer.

## Fail-closed rule

Any clause failure must:
- mark the job `failed` (never `complete`)
- persist `failure_code` matching this contract
- persist `failed_at` (which clause/stage)
- never substitute partial output as if it were complete

The UI must never invent a friendlier explanation than the persisted failure code.

## Tier 2 mechanical assertion rule

Tier 2 stress assertions must map one-to-one to the clauses above. Each assertion must:
- name the clause it enforces
- read only persisted fields, not in-memory transients
- fail with the contract's `failure_code`, not a generic message

Machine-readable constants for these clauses live in `tests/contract/long-form-contract.ts` (PR-B).

## Amendment rule

Changes to this contract require:
- a separate docs-only PR
- a brief rationale block (incident, fixture, scale issue)
- no bundled runtime changes
- companion update to PR-B constants in the same release train, but not the same PR

## Acceptance bar

A failed long-form run can be classified by reading one persisted field (`failure_code`) and mapped to exactly one clause in this contract — without reading worker logs.
