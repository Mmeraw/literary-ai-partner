# Calibration Analysis Tooling Governance Brief

**Status**: LOCKED — Implementation may begin

## Purpose

Provide the analysis tooling required to consume `compression_governance_state` and `representation_compression_ratio` telemetry once the #293 Phase 2 calibration window accumulates ≥ 100 long-form jobs. The tooling produces the distributional analysis artifact required by `PR_293_PHASE_2_PREVIEW_BRIEF.md` prerequisites.

This is **observation infrastructure**, not enforcement. No production runtime changes. No threshold derivation in this lane.

## Scope (in)

1. `scripts/governance/analyze-phase-2-calibration.ts` — Node script that:
   - Reads telemetry records from a JSON input file (or stdin) containing per-job `compression_governance_state` + `representation_compression_ratio` + manuscript metadata.
   - Generates histogram bucket counts.
   - Computes statistical summary: mean, median, p10, p25, p50, p75, p90, p95, p99.
   - Computes class coverage table: counts per band (`pass | warn | observe | null`).
   - Identifies outliers (ratio < p1 or ratio > p99).
   - Outputs structured JSON for downstream visualization + a markdown summary skeleton.

2. `scripts/governance/types.ts` — Typed interfaces for input telemetry records, histogram output, statistical summary, and class coverage table.

3. `tests/scripts/analyze-phase-2-calibration.test.ts` — Unit tests with synthetic input covering:
   - Empty input → empty output (graceful handling).
   - Uniform distribution → expected band counts.
   - Skewed distribution → correct percentile computation.
   - Mixed long-form + short-form input → short-form correctly excluded from band analysis.
   - Outlier detection accuracy.

4. `docs/governance/phase-2-calibration-template.md` — Markdown skeleton for the eventual calibration data artifact (the document that, once filled, satisfies Phase 2 lock prerequisite #2).

## Scope (out)

- ❌ No threshold derivation (that's Phase 2 governance lock work).
- ❌ No production runtime changes.
- ❌ No Supabase/database queries (input is JSON; the query layer is a separate concern).
- ❌ No visualization frontend (script outputs structured data; rendering is downstream).
- ❌ No automatic Phase 2 promotion (the analysis informs Phase 2 governance, doesn't trigger it).

## Acceptance bar (5-point gate)

1. Analysis script implemented in `scripts/governance/`.
2. Typed interfaces defined and exported from `scripts/governance/types.ts`.
3. Unit tests cover empty, uniform, skewed, mixed-form, and outlier cases.
4. Markdown calibration template exists with all sections required by `PR_293_PHASE_2_PREVIEW_BRIEF.md` Prerequisite 2.
5. CI/typecheck green; no production-path modifications.

## File targets

- `scripts/governance/analyze-phase-2-calibration.ts` (new)
- `scripts/governance/types.ts` (new)
- `tests/scripts/analyze-phase-2-calibration.test.ts` (new)
- `docs/governance/phase-2-calibration-template.md` (new)

## Strategic position

This brief stages the **bridge** between Phase 1 observation (already live via PR #411) and Phase 2 enforcement (preview-only via `PR_293_PHASE_2_PREVIEW_BRIEF.md`). Without analysis tooling, the calibration window produces raw data with no path to interpretation. With it, the moment N ≥ 100 long-form jobs are collected, an operator can run a single command and produce the distributional artifact required for Phase 2 lock.

## Refs

Refs #291, #292, #293, #404, #405, #406, #407, #409, #411, #412
