# 293 Phase 2 Calibration Data Template

> Purpose: Fill this document with output from `scripts/governance/analyze-phase-2-calibration.ts` once the calibration window prerequisites are met.

## Inputs

- Observation window start:
- Observation window end:
- Long-form jobs analyzed:
- Short-form jobs observed (excluded from long-form ratio analytics):
- Distinct manuscript genres/types represented:

## Compression Ratio Distribution (Long-form)

- Include histogram of `representation_compression_ratio`.
- Include notes on shape (clustered, multimodal, skewed).

## Statistical Summary (Long-form)

- mean:
- median:
- p10:
- p25:
- p75:
- p90:
- p95:
- p99:

## Governance Band Coverage (Long-form)

| Band | Count | Percent |
| --- | ---: | ---: |
| pass |  |  |
| warn |  |  |
| observe |  |  |
| null |  |  |

## Per-Genre / Manuscript-Class Breakdown

- Provide summary table for each available grouping.
- Call out class-conditional drift if present.

## Dark Criteria Frequency

- Count jobs with any `criteria_with_zero_evidence`.
- List top criteria by zero-evidence frequency.
- Describe recurring dark-criteria patterns.

## Evidence Density by Criterion

- Average evidence count per long-form job by criterion.
- Median/p90 evidence counts by criterion.
- Criteria with consistently low evidence density.

## Outlier Patterns

- Jobs below p1 and above p99.
- Root-cause hypothesis for each outlier cluster.
- False-positive risk notes for threshold derivation.

## Threshold Derivation Proposal (Prerequisite 3)

- Proposed threshold(s):
- Distributional rationale:
- Stress-test notes against outliers:
- Why this avoids false hard-fail on legitimate runs:

## Reversal Mechanism Plan (Prerequisite 4)

- Runtime override mechanism:
- Audit log contract for override invocation:
- Monitoring signal for hard-fail rate:

## Decision

- [ ] Not ready for Phase 2 lock (insufficient evidence)
- [ ] Ready to draft Phase 2 governance lock

## References

- `PR_293_PHASE_2_PREVIEW_BRIEF.md`
- `CALIBRATION_ANALYSIS_TOOLING_GOVERNANCE_BRIEF.md`
