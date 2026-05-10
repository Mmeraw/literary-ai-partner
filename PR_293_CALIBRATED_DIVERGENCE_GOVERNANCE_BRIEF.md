# PR #293 — Calibrated Divergence-Collapse Governance (Telemetry-First)

## Status

Lane opens after #292 SIPOC merge. This phase is calibration-first and observability-only.

## Purpose

Replace the existing binary `Pass3Guard:DIVERGENCE_COLLAPSE_WARNING` with calibrated governance using `representation_compression_ratio`, while explicitly avoiding fail-closed behavior until empirical production distributions are established.

## Governance correction (binding for Phase 1)

Do **not** introduce `hard_fail` behavior yet for `representation_compression_ratio`.

Phase 1 remains telemetry-first calibration with states:
- `pass`
- `warn`
- `observe`

Goal of #293: replace noisy binary divergence warning with calibrated observability, not immediate enforcement escalation.

## Background

The binary divergence warning is too coarse:
- Some short-form runs legitimately show zero divergences without overcompression risk.
- Synthetic fixtures can distort apparent compression behavior.
- Long-form enforcement thresholds must be derived from production telemetry histograms across multiple manuscript classes.

With SIPOC now live, we can calibrate on real distributions first, then consider fail-closed governance in a later lane.

## Scope (in)

1. Replace binary divergence-collapse warning with calibrated ratio-band logic.
2. Add governance state to telemetry:
   - `pass`: ratio >= empirical_warn_threshold
   - `warn`: ratio below warn threshold
   - `observe`: extreme low band, flagged for analysis only
3. Emit explanatory metadata to support threshold tuning (e.g., observed ratio and selected band).
4. Add tests that validate state assignment and short-form non-regression.

## Non-goals (out)

- No hard fail behavior in this PR.
- No retry/halt behavior changes.
- No prompt, scoring, QG, or UI changes.
- No SIPOC schema redesign beyond additive governance-state emission.

## Acceptance bar

- [ ] Calibrated pass/warn/observe logic implemented in runtime quality guard path.
- [ ] Telemetry includes governance state for long-form runs.
- [ ] Tests assert all three bands with deterministic fixtures.
- [ ] Short-form behavior unchanged.
- [ ] CI/typecheck green.

## File targets

- `lib/evaluation/governance/runtimeQualityGuards.ts` — replace binary warning with calibrated bands
- `lib/evaluation/pipeline/types.ts` — add governance state field (additive)
- `lib/evaluation/pipeline/runPass3Synthesis.ts` — emit governance state
- `tests/evaluation/runtime-quality-guards.test.ts` — add/extend threshold-band tests

## Required tests

1. `compression_pass_band` — ratio in pass band emits `pass`
2. `compression_warn_band` — ratio in warn band emits `warn`
3. `compression_observe_band` — ratio in extreme low band emits `observe`
4. `short_form_compression_governance_unchanged` — short-form semantics unchanged

## Threshold discipline

Initial thresholds are provisional and must be treated as calibration aids.
Promotion to any fail-closed policy requires:
1. Production telemetry histogram collection,
2. Distribution review across multiple manuscript classes,
3. Governance sign-off in a separate enforcement PR.

## Why now

- SIPOC measurement backbone is live from #292.
- Existing binary warning is already known to be noisy.
- Small-scope, high-leverage improvement with low blast radius.
- Establishes evidence-driven governance progression (measure -> calibrate -> enforce).
