## Summary

Centralizes pass-level model routing and per-pass telemetry so the evaluation pipeline’s model choice is explicit, auditable, and reversible.

## Scope

Pass selection:
- [ ] Pass 1
- [ ] Pass 2
- [x] Pass 3

Changed files:
- `lib/config/evaluationRuntimeConfig.ts`
- `lib/evaluation/pipeline/runPass1.ts`
- `lib/evaluation/pipeline/runPass2.ts`
- `lib/evaluation/pipeline/runPass3Synthesis.ts`
- `scripts/pipeline/run-phase2-7-real-run.ts`

Out of scope:
- Scoring changes
- Prompt changes
- Quality-gate changes
- Editorial repair logic
- UI changes

## Contract Integrity

- Pass routing resolves from one canonical config authority.
- `EVAL_PASS1_MODEL`, `EVAL_PASS2_MODEL`, `EVAL_PASS3_MODEL`, and `EVAL_PASS3_FALLBACK_MODEL` are explicit and test-covered.
- Per-pass telemetry records the selected model, retry/fallback state, and duration.
- The real-run entrypoint prints resolved routing at startup for auditability.
- No scoring semantics change.

## Behavioral Quality

This PR is not reducing intelligence.

The goal is observability and control, not output simplification.
- pass selection becomes explicit instead of ad hoc
- telemetry makes model behavior reproducible
- fallback usage is visible instead of implicit
- routing changes can be rolled back by config alone

## Latency Evidence

### Baseline (Pre-change)

| Run | pass3_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | Baseline before explicit routing/telemetry |
| Run 2 | N/A | N/A | Baseline before explicit routing/telemetry |

### Post-change Runs

| Run | pass3_ms | total_ms | Notes |
|---|---:|---:|---|
| Run 1 | N/A | N/A | Routing and telemetry only; no scoring/prompt behavior change |
| Run 2 | N/A | N/A | Routing and telemetry only; no scoring/prompt behavior change |

## Quality Gate / Anomalies

QG_<gate-id>: no QG behavior changes in this PR

## Risks & Anomalies

- Risk: routing drift if config is split across too many environment variables. Mitigation: centralize reads in evaluationRuntimeConfig.
- Risk: telemetry may be incomplete if pass runners do not emit the same fields. Mitigation: add focused tests for each pass.
- Risk: startup routing printout can become stale if config resolution changes. Mitigation: treat the routing printout as derived from the same config accessor used by the runners.

## Architecture Alignment

- alignment: post-#384 architecture-aligned
- mitigation_expiry: no expiry; this is the canonical routing surface
- dependent_architecture: PR1 recovery/no-hang behavior
- expected_revisit: no
- replay_ids_at_risk:
- replay_ids_targeted:

## Recommended PR body

### Summary
Centralize pass-level model routing and add per-pass telemetry for auditability and future benchmark-driven model selection.

### Why
The pipeline now uses distinct passes with different workload characteristics. Model choice is already effectively pass-specific in runtime behavior but not governed explicitly enough for traceability and controlled routing.

### Scope
- add `EVAL_PASS1_MODEL` / `EVAL_PASS2_MODEL` / `EVAL_PASS3_MODEL` / `EVAL_PASS3_FALLBACK_MODEL`
- resolve models in one canonical runtime config module
- emit model/token/latency/retry telemetry per pass
- print resolved routing in the real-run entrypoint

### Non-goals
- no scoring changes
- no prompt changes
- no quality gate changes
- no synthesis logic changes beyond routing consumption
- no editorial repair changes

### Acceptance
- every pass records its exact selected model and token envelope
- config-only routing change is possible without code drift
- rollback to prior routing is a single env change away
- real-run output prints resolved routing at startup
