# Canonical Runtime Operations (Authoritative)

## Non-Negotiable Runtime Doctrine

No RevisionGrade evaluation may be persisted or shown unless it is produced by the canonical pipeline (`runPipeline`), synthesized through governed passes, and written via canonical processor flow.

## Canonical Runtime Spine

1. Entrypoints
   - `app/api/workers/process-evaluations/route.ts`
   - `app/api/jobs/[jobId]/run-phase2/route.ts`
   - `app/api/admin/jobs/[jobId]/run-phase2/route.ts`
2. Processor adapter
   - `lib/evaluation/processor.ts`
   - Responsibilities only: load job/input, call `runPipeline`, persist canonical artifact, write status/progress/error state.
3. Sovereign evaluator engine
   - `lib/evaluation/pipeline/runPipeline.ts`
4. Canonical artifact output
   - `evaluation_artifacts` row with `artifact_type="evaluation_result_v1"`

## Quarantined Legacy Paths (Non-Authoritative)

- `workers/phase2Worker.ts`
- `workers/phase2Evaluation.ts`
- `lib/jobs/phase2.ts`

These are legacy compatibility paths only.

### Kill-switch semantics

- Legacy worker path requires: `ENABLE_LEGACY_PHASE2_WORKER=1`
- Legacy lib/jobs runtime path requires: `ENABLE_LEGACY_PHASE2_RUNTIME=1`

If unset, these paths fail loudly by design.

## Operator Rules

1. Do not run or document legacy Phase 2 executors as normal runtime.
2. Treat legacy execution as migration-only/quarantine behavior.
3. Any production issue triage must begin from canonical entrypoints above.
4. If docs conflict with code, this file and architecture invariants are authoritative.

## CI/Invariant Enforcement

Architecture invariants enforce:

- processor adapter uses `runPipeline`
- processor has no direct OpenAI evaluator authority
- production entrypoints do not import legacy Phase 2 authorities
- worker entrypoint remains canonical

See: `__tests__/lib/evaluation/architecture-invariants.test.ts`
