<!--
  Default universal template (fail-safe fallback).

  Prefer typed templates when creating PRs:
  - Evaluation pipeline: ?template=evaluation.md
  - UI / frontend:       ?template=ui.md
  - Application code:    ?template=code.md
  - CI / infra:          ?template=infra.md
  - Docs / governance:   ?template=docs.md
  - DB migration:        ?template=migration.md
  - Minor trivial:       ?template=minor.md

  Governance contract: docs/PR_TEMPLATE_TYPED_SCOPE_GOVERNANCE.md
-->

## Summary

N/A — replace with a concise 1–3 sentence summary of what changed and why.

## Scope

N/A — replace with touched paths/surfaces and explicit out-of-scope boundaries.

## Tests Updated

N/A — replace with tests added/updated, or explain why no tests are needed.

## Visual Evidence

N/A — non-UI change; if UI is touched, attach screenshots/video and acceptance notes.

## Accessibility

N/A — non-UI change; if UI is touched, include keyboard/contrast/screen-reader notes.

## Browser Targets

N/A — non-UI change; if UI is touched, list verified browser targets.

## CI/Infra Scope

N/A — no CI/infra behavior changes unless listed in Scope.

## Rollback Plan

N/A — replace with concrete rollback/revert steps if this change is operationally impactful.

## Affected Workflows

N/A — no workflow changes unless listed in Scope.

## Schema Diff

N/A — no schema changes unless listed in Scope.

## Data Backfill

N/A — no backfill unless listed in Scope.

## Rollback Posture

N/A — no migration rollback posture required unless schema/backfill changes exist.

## Lock / Table-Scan Risk

N/A — no migration/table-scan risk unless schema/backfill changes exist.

## Data Backfill Risk

N/A — no backfill risk unless a backfill is included.

## RLS / Access Impact

N/A — no RLS/access-control changes unless listed in Scope.

## Production Verification Query

N/A — no migration verification query required unless schema changes exist.

## Unauthorized Input Sources

N/A — replace with explicit input sources and authorization/validation boundaries for this PR.

## Internal Process Leakage

N/A — replace with confirmation that no internal-only process details are exposed.

## Input → Action → Output

N/A — replace with the user-visible Input → Action → Output flow for this change.

## Public-Safe Quality/Status Metrics

N/A — replace with public-safe metrics/status exposure notes for this change.

## Runtime/Pipeline Expansion

N/A — replace with declaration of runtime/pipeline expansion (or explicit none with reason).

## Latency Impact

N/A — replace with latency impact evidence or explicit no-impact rationale.

## Evaluation Process Change Declaration

Process Change: no

Pass selection (check exactly one):

- [ ] Pass 1
- [x] Pass 2
- [ ] Pass 3

- [ ] Sequential phase-gate doctrine preserved (parallelism only within safe sub-workloads).
- [ ] Phase 0 remains first and is proven before downstream processing.
- [ ] Phase 2 remains blocked on accepted_story_ledger_v1 (Review Gate authority).
- [ ] Phase 3 remains blocked on pass12_handoff_v1 and is sole owner of Pass 3B synthesis.
- [ ] Deterministic quality gates run after Pass 3B and before completion.
- [ ] WAVE remains post-evaluation (after evaluation_result_v2) and non-fatal to base evaluation.

One-line doctrine: The pipeline is sequential at the phase/gate level and parallel only inside safe sub-workloads.

Process-Change Impact Summary (required when Process Change: yes):

- N/A — process-change summary not required because Process Change is set to no.

## Contract Integrity

N/A — replace with contract-integrity evidence relevant to this PR.

## Behavioral Quality

This PR is not reducing intelligence.

N/A — replace with behavioral quality evidence relevant to this PR.

## Latency Evidence

Baseline (Pre-change)

| Run | pass2_ms | total_ms | Notes |
| --- | --- | --- | --- |
| Run 1 | N/A | N/A | N/A — replace for evaluation-path changes |
| Run 2 | N/A | N/A | N/A — replace for evaluation-path changes |

Post-change Runs

| Run | pass2_ms | total_ms | Notes |
| --- | --- | --- | --- |
| Run 1 | N/A | N/A | N/A — replace for evaluation-path changes |
| Run 2 | N/A | N/A | N/A — replace for evaluation-path changes |

## Quality Gate / Anomalies

QG_none — N/A — replace with quality-gate/anomaly disclosure for evaluation-path changes.

## Risk

N/A — replace with explicit low-risk rationale for minor/trivial PRs.

## Branch Freshness (Never Behind)

Branch-Behind-Base: 0

## Risks & Anomalies

N/A — replace with concrete risks/anomalies and mitigations.

---

No-Pipeline-Impact: N/A — replace with explicit pipeline impact declaration for this PR.
