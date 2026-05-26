<!-- Comet template-unification: enforcement-compliant default body. -->
<!-- DO NOT delete required ## headings unless your PR is migration/docs-only (auto-skipped by latency-pr-enforcement.yml). -->

## Summary

<!-- One-paragraph what + why. -->

## Scope

Pass selection (CHECK EXACTLY ONE — Pass 2 pre-checked as default):

- [ ] Pass 1
- [x] Pass 2
- [ ] Pass 3

Changed files:

-

Out of scope:

-

## Evaluation Process Change Declaration

Process Change: no | yes

<!--
If this PR changes evaluation process sequencing, gating, phase ownership, or recovery behavior,
set "Process Change: yes" and complete all checks below with [x].
-->

- [ ] Sequential phase-gate doctrine preserved (parallelism only within safe sub-workloads).
- [ ] Phase 0 remains first and is proven before downstream processing.
- [ ] Phase 2 remains blocked on accepted_story_ledger_v1 (Review Gate authority).
- [ ] Phase 3 remains blocked on pass12_handoff_v1 and is sole owner of Pass 3B synthesis.
- [ ] Deterministic quality gates run after Pass 3B and before completion.
- [ ] WAVE remains post-evaluation (after evaluation_result_v2) and non-fatal to base evaluation.

One-line doctrine: The pipeline is sequential at the phase/gate level and parallel only inside safe sub-workloads.

Process-Change Impact Summary (required when Process Change: yes):

-

## Contract Integrity

-

## Behavioral Quality

This PR is not reducing intelligence.

<!-- Describe quality preservation. The phrase above is REQUIRED verbatim by enforcement. -->

## Latency Evidence

### Baseline (Pre-change)

| Run | pass2_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | |
| Run 2 | N/A | N/A | |

### Post-change Runs

| Run | pass2_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | |
| Run 2 | N/A | N/A | |

<!-- For Pass 3 PRs: also include criteria_count_by_state. -->

## Quality Gate / Anomalies

QG_<gate-id>: <description or "no QG_ behavior changes">

## Risks & Anomalies

-

## Architecture Alignment

- alignment: pre-#384 mitigation | post-#384 architecture-aligned
- mitigation_expiry:
- dependent_architecture:
- expected_revisit: yes | no
- replay_ids_at_risk:
- replay_ids_targeted:

<!-- pr-type: evaluation -->
