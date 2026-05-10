# PR #293 Phase 2 — Calibrated Fail-Closed Enforcement

## Status

**PREVIEW ONLY — NOT YET LOCKABLE**

This brief documents the structure of the eventual Phase 2 lock, but it must not be merged or treated as authoritative until calibration data from Phase 1 exists and justifies thresholds.

Phase 1 (the seed-band observational classifier) is implemented in `feat/293-calibrated-divergence-governance`. Phase 2 begins only after the calibration window produces representative distributional data on `representation_compression_ratio` across real production manuscripts.

## Why this is a preview, not a lock

Phase 1 deliberately uses **seed bands** (`>= 0.10` pass, `0.05–0.10` warn, `< 0.05` observe) chosen by intuition, not by data. These bands are starting points for observation, not validated thresholds. Locking Phase 2 fail-closed enforcement against intuition-derived thresholds would:

- Block legitimate runs whose compression ratios fall outside band assumptions.
- Embed unverified statistical assumptions into runtime governance.
- Violate the discipline that produced #291 → #406 in the first place.

Phase 2 must wait for evidence.

## Required prerequisites for locking Phase 2

All of the following must be true before this brief can be promoted to a real governance lock PR:

### Prerequisite 1 — Calibration window

A documented observation period during which Phase 1 has been live in production and `compression_governance_state` telemetry has been captured for at least:

- N ≥ 100 long-form jobs across at least 3 distinct manuscript types/genres.
- N ≥ 200 short-form jobs (for non-regression baseline).
- A minimum of 7 days of continuous production traffic (calendar coverage to capture day-of-week effects).

### Prerequisite 2 — Distributional analysis artifact

A repo-committed analysis document (e.g., `docs/governance/293-phase-2-calibration-data.md`) containing:

- Histogram of `representation_compression_ratio` for long-form jobs.
- Per-genre/manuscript-type breakdown of the distribution.
- Class coverage table: how many jobs fell in each Phase 1 band (`pass | warn | observe`).
- Identified outlier patterns and their root causes (e.g., very short manuscripts, repetitive content, genre conventions).
- Statistical summary: mean, median, p10, p25, p75, p90, p95, p99 of ratios.

### Prerequisite 3 — Threshold derivation

The proposed Phase 2 thresholds must be:

- Derived from the actual distribution, not from intuition.
- Justified in writing, with reference to the analysis artifact.
- Stress-tested against the observed outlier patterns to confirm no false hard-fails on legitimate runs.

### Prerequisite 4 — Reversal mechanism

Phase 2 fail-closed enforcement must include:

- A documented runtime override (e.g., environment variable, feature flag, or governance disable token) for emergencies.
- An audit log entry whenever the override is invoked.
- A monitoring dashboard or alert for hard-fail rate.

## Scope (when lockable)

In:
- Promote `observe` band → `hard_fail` for long-form jobs below the calibrated threshold.
- Add retry-or-halt behavior on hard-fail.
- Surface hard-fail state in user-facing evaluation status.
- Add hard-fail rate to system telemetry.

Out:
- ❌ Changing the SIPOC schema.
- ❌ Adding new bands beyond `pass | warn | hard_fail`.
- ❌ Modifying short-form behavior.
- ❌ Changing prompt/scoring/QG.

## Acceptance gate (when lockable)

1. Calibration data artifact merged in repo and referenced in Phase 2 governance PR.
2. Threshold values explicitly justified by distributional evidence.
3. Hard-fail invariant tests cover the chosen threshold band.
4. Override mechanism implemented and documented.
5. Hard-fail rate monitoring is live.
6. Short-form behavior unchanged.
7. CI/typecheck green.

## Required tests (when lockable)

- `phase_2_hard_fail_band: ratio < calibrated_threshold → hard_fail` for long-form.
- `phase_2_pass_band` and `phase_2_warn_band` updated to reflect data-driven thresholds.
- `phase_2_override_mechanism: override flag bypasses hard-fail with audit log entry`.
- `short_form_compression_governance_unchanged` continues to pass.

## Strategic posture

Phase 2 is a **promotion**, not an addition. The Phase 1 `observe` state is not a placeholder — it is the calibration mechanism. Promoting it requires the data the calibration was designed to produce.

If Phase 1 data shows the seed bands were wrong, **the bands change**, the `observe` band redefines its threshold, and Phase 2 may be deferred indefinitely. That is a feature, not a failure.

## What this preview is for

This file exists so that:

1. Future implementers can see exactly what Phase 2 will require.
2. Phase 2 cannot be silently skipped or rushed.
3. The discipline of evidence-before-enforcement is documented at the file level, not just in conversation.

If you are a future contributor and you find this file: **do not lock Phase 2 without the four prerequisites above**. Instead, first execute the calibration analysis, commit the data artifact, and then promote this preview to a real governance brief.

## Related documents

- `docs/governance/governance-before-implementation.md`
- `PR_293_CALIBRATED_DIVERGENCE_GOVERNANCE_BRIEF.md` (Phase 1, locked via #407)
- Future: `docs/governance/293-phase-2-calibration-data.md` (does not yet exist)
- Future: `PR_293_PHASE_2_GOVERNANCE_BRIEF.md` (does not yet exist; this preview becomes that file when prerequisites are met)
