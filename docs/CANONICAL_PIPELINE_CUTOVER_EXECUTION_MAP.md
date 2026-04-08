# Canonical Pipeline Cutover Execution Map

## Non-Negotiable Doctrine

> No RevisionGrade evaluation may be persisted or shown unless it is produced by the canonical pipeline (`runPipeline`), synthesized from governed passes, and approved by configured cross-check authority.

## Current Reality (verified)

- Live worker route currently executes `processQueuedJobs()` from `lib/evaluation/processor.ts`:
  - `app/api/workers/process-evaluations/route.ts`
- Multi-pass canonical orchestrator exists but is not the single live spine:
  - `lib/evaluation/pipeline/runPipeline.ts`
- Separate Phase 2 worker/eval paths are still active in repo:
  - `workers/phase2Worker.ts`
  - `workers/phase2Evaluation.ts`
- Additional admin route invokes different Phase 2 aggregation path:
  - `app/api/admin/jobs/[jobId]/run-phase2/route.ts`
  - `lib/jobs/phase2.ts`

This is architectural split-brain and must be collapsed.

## Canonical Sovereign Path

`route/worker entrypoint` -> `processor adapter` -> `runPipeline` -> `governance decision` -> `persist canonical artifact + status`

`processor.ts` remains as job-plumbing adapter only (claim/load/progress/persist/error), not a second evaluator.

## File-by-File Execution Map

| File | Current Role | Target Role | Exact Change | Keep/Delete |
|---|---|---|---|---|
| `lib/evaluation/pipeline/runPipeline.ts` | Multi-pass orchestrator mostly used by scripts/tests | **Canonical evaluation engine** | Make this the only path for evaluation intelligence; ensure pass sequence + governance authority is complete and returned as explicit decision payload | **KEEP (canonical)** |
| `lib/evaluation/pipeline/runPass1.ts` | Pass 1 evaluator | Canonical pass 1 | Keep as-is except model-policy import centralization and prompt contract tightening | KEEP |
| `lib/evaluation/pipeline/runPass2.ts` | Independent parallel evaluator | **Adversarial audit of Pass 1 against source text** | Change prompt/inputs so Pass 2 receives source + Pass 1 output and must produce structured critique deltas | KEEP |
| `lib/evaluation/pipeline/runPass3Synthesis.ts` | Synthesis pass | Canonical synthesis judge | Enforce disagreement handling contract (no silent averaging; explicit dispute reasons) | KEEP |
| `lib/evaluation/pipeline/perplexityCrossCheck.ts` | Optional cross-check | Configured external adjudicator | Implement one explicit authority mode via config (`optional|required|veto`) and return normalized adjudication flags | KEEP |
| `lib/evaluation/governance/evaluatePass4Governance.ts` | Governance decision helper | Final pass/fail authority gate | Encode hard block/soft degrade matrix and required status codes for persistence layer | KEEP |
| `lib/evaluation/processor.ts` | Live evaluator + job processor | **Thin adapter only** | Remove internal scoring/evaluation logic; call `runPipeline`; map result to canonical artifact/status/progress/error writes only | KEEP (adapter) |
| `app/api/workers/process-evaluations/route.ts` | Live worker route to processor | Canonical route entrypoint | Keep auth/ops shell; ensure route triggers only processor adapter which must call `runPipeline` | KEEP |
| `workers/phase2Evaluation.ts` | Separate OpenAI evaluation engine | Legacy shim or removed | Stop using for core evaluation path; either (A) wrap canonical pipeline invocation for compatibility or (B) hard-deprecate | **SHIM -> DELETE** |
| `workers/phase2Worker.ts` | Separate job orchestration path | Legacy shim or removed | Route through processor adapter/canonical pipeline only; remove parallel evaluator responsibility | **SHIM -> DELETE** |
| `lib/jobs/phase2.ts` | Separate phase aggregation/persistence model | Legacy admin-only utility or removed | If still needed for historical reports, label as non-canonical aggregation utility; block use in evaluation runtime path | **QUARANTINE** |
| `app/api/admin/jobs/[jobId]/run-phase2/route.ts` | Admin trigger for alternate phase2 flow | Canonical admin replay endpoint | Switch to canonical replay/re-run API using `runPipeline`; avoid invoking legacy aggregation path for evaluations | KEEP (repointed) |
| `app/api/evaluate/route.ts` | Creates jobs | Canonical job intake | Keep intake only; ensure queued job metadata required by canonical pipeline exists and no path-specific flags leak in | KEEP |

## Required Shared Policy Module (create once, import everywhere)

Create `lib/evaluation/pipeline/policy.ts` (or equivalent) as the single source for:

- model assignments by role (`pass1`, `pass2`, `pass3`, `external_adjudicator`)
- request compatibility (`max_tokens` vs `max_completion_tokens`, temperature support)
- timeout/retry/token limits
- disagreement thresholds and confidence downgrade rules
- external authority mode (`optional|required|veto`)

No model defaults in scattered files after cutover.

## Three-Phase Cutover Plan

### Phase A — Doctrine Lock (no routing yet)

1. Add canonical doctrine doc + architecture ADR
2. Add policy module + authority mode enum
3. Add invariant tests that fail on bypass

### Phase B — Routing Cutover (single spine)

1. Rewire `processor.ts` to call `runPipeline` only
2. Keep route/auth surfaces unchanged (`process-evaluations/route.ts`)
3. Ensure persistence contract is written from one result envelope only

### Phase C — Legacy Shutdown

1. Mark legacy files as deprecated with hard runtime guards
2. Remove legacy env toggles and alternate model defaults
3. Delete legacy evaluator paths after one clean release cycle

## Invariant Tests (must exist)

1. **Entrypoint invariant:** every production evaluation entrypoint must transitively invoke `runPipeline`.
2. **Policy invariant:** no evaluation path may set model parameters outside canonical policy module.
3. **Persistence invariant:** only governance-approved outputs can be persisted as final artifacts.
4. **Status invariant:** job transitions and error fields use canonical contract (`queued|running|complete|failed`, `last_error`).

## First PR Slice (safest surgical start)

1. Introduce shared policy module (`policy.ts`) and migrate model/request compat helpers there.
2. Refactor `processor.ts` evaluation core to call `runPipeline` and adapt output.
3. Add invariant tests for entrypoint + policy bypass detection.
4. Keep worker route unchanged except for invoking updated processor behavior.

## Definition of Done for “No Mixed Architecture”

- [ ] One and only one evaluation intelligence path: `runPipeline`
- [ ] `processor.ts` contains no independent scoring logic
- [ ] Live route and admin replay both use canonical path
- [ ] Legacy worker/evaluation paths quarantined or deleted
- [ ] Invariant tests prevent architectural drift
- [ ] Governance authority mode explicitly configured and enforced
