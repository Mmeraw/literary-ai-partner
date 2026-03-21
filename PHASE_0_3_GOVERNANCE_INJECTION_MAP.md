# Phase 0.3 — Governance Injection Map

## Status

**IMPLEMENTED (runtime-bound, fail-closed)**

## Purpose

Phase 0.3 defines and validates the canonical governance injection map for the evaluation pipeline.

This map makes control points explicit and auditable by answering:

- where governance checks fire,
- what enters each checkpoint,
- what exits each checkpoint,
- what action can be taken (ALLOW/WARN/BLOCK/AUDIT),
- which authority governs that checkpoint,
- which downstream stages are affected.

## Runtime Binding

The runtime map is implemented in:

- `lib/governance/injectionMap.ts`

The pipeline binds and validates it at startup:

- `lib/evaluation/pipeline/runPipeline.ts`

If the map is invalid or incomplete, pipeline execution fails closed with:

- `GOVERNANCE_INJECTION_MAP_INVALID`

## Stage Matrix

| Checkpoint ID | Stage | Primary Action | Authority | Block Code (if BLOCK) | Downstream Impact |
|---|---|---|---|---|---|
| `CANON_REGISTRY_BINDING` | `pipeline_boot` | `BLOCK` | `docs/NOMENCLATURE_CANON_v1.md` | `CANON_REGISTRY_BIND_FAILED` | blocks pass1-pass4 |
| `CANON_GATE` | `pipeline_boot` | `BLOCK` | `AI_GOVERNANCE.md` | `CANON_REGISTRY_EMPTY` | blocks pass1-pass4 |
| `LLR_POST_STRUCTURAL` | `post_pass1` | `BLOCK` | `Phase 0.2 Lessons Learned` | `LLR_POST_STRUCTURAL_BLOCK` | blocks pass2-pass4 |
| `LLR_POST_DIAGNOSTIC` | `post_pass2` | `BLOCK` | `Phase 0.2 Lessons Learned` | `LLR_POST_DIAGNOSTIC_BLOCK` | blocks pass3-pass4 |
| `LLR_POST_CONVERGENCE` | `post_pass3` | `BLOCK` | `Phase 0.2 Lessons Learned` | `LLR_POST_CONVERGENCE_BLOCK` | blocks pass4 |
| `LLR_PRE_ARTIFACT_GENERATION` | `pre_pass4` | `BLOCK` | `Phase 0.2 Lessons Learned` | `LLR_PRE_ARTIFACT_GENERATION_BLOCK` | blocks pass4 |
| `ELIGIBILITY_GATE` | `post_evaluation_envelope` | `BLOCK` | `Volume II-A Eligibility Gate` | `REFINEMENT_BLOCKED_BY_GATE` | blocks downstream refinement path |
| `QUALITY_GATE` | `pass4` | `BLOCK` | `Phase 2.7 Quality Gate` | `QG_UNKNOWN` | blocks artifact certification |
| `HUMAN_REVIEW_BOUNDARY` | `post_pass4` | `AUDIT` | `Operations Runbook` | n/a | manual intervention boundary |
| `ARTIFACT_CERTIFICATION_BOUNDARY` | `artifact_certification` | `AUDIT` | `docs/JOB_CONTRACT_v1.md` | n/a | governs publishability |
| `FAILURE_ESCALATION_DEAD_LETTER` | `failure_path` | `WARN` | `Operations Runbook` | n/a | dead-letter escalation |

## Validation Rules

The map validator enforces:

1. Map is non-empty.
2. Checkpoint IDs are unique.
3. Every required checkpoint exists.
4. Any `BLOCK` checkpoint must define `blockErrorCode`.
5. `llrStage` may only appear on `LLR_*` checkpoints.

## Test Coverage

- `lib/governance/__tests__/injectionMap.test.ts`
  - required checkpoint completeness
  - duplicate ID rejection
  - missing checkpoint rejection
  - LLR stage mapping correctness
  - canonical checkpoint metadata access

- `tests/evaluation/pipeline/pipeline-e2e.test.ts`
  - fail-closed on invalid injection map
  - checkpoint metadata present in block errors

## Notes

- Observability remains passive; no control-flow alteration outside explicit action semantics.
- No changes to canonical job status values.
- No changes to Phase 2.8 or Phase 3.0 scope.
