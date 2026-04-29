## Summary

Switches Eval 2 success-path persistence from sequential writes to one atomic RPC call (`persist_evaluation_v2_atomic`).

This removes the partial-write window where artifact upsert could succeed but job completion update could fail.

## Dependency (CRITICAL)

Requires `persist_evaluation_v2_atomic` RPC to exist in target Supabase before this code is deployed.

Deploy order:
1. Merge/apply migration PR first
2. Verify RPC exists and permissions are correct
3. Deploy this boundary-switch PR

Failure mode if order is violated:
- success-path evaluations fail closed due to missing RPC/function

## Scope

- `lib/evaluation/persistEvaluationResultV2.ts`
  - success path now calls `persist_evaluation_v2_atomic`
  - old `upsert -> readback -> completion update` sequence removed
- `__tests__/lib/evaluation/persistEvaluationResultV2.boundary-gate.test.ts`
  - success assertions updated for RPC path
  - RPC fail/no-artifact-id fail-closed tests added
- `__tests__/lib/evaluation/processor.contamination-guard.test.ts`
  - updated to assert atomic RPC persistence path

Failure paths remain unchanged:
- structural validation fail path
- boundary gate fail path

## Contract Integrity

Before:
- artifact upsert
- artifact readback
- completion update

After:
- single boundary RPC call:
  - artifact upsert + job completion in one transaction

Preserved fields include:
- `status=complete`
- `phase=phase_2`
- `phase_status=complete`
- `validity_status=valid`
- `evaluation_result`
- `evaluation_result_version`
- `progress.gate_enforcement`
- completion/heartbeat timestamps

## Behavioral Quality

- Quality-gate behavior unchanged.
- Validation/gate failure paths unchanged.
- Boundary ownership preserved.
- Layering doctrine preserved (pipeline produces, boundary persists).

## Latency Evidence

Pass selection:
- [ ] Pass 1
- [ ] Pass 2
- [x] Pass 3

| Run | pass3_ms | total_ms | Notes |
|-----|---------:|---------:|-------|
| Baseline Run 1 | N/A | ~3:12 | Job `5cca06a2` (pre-Block-B) |
| Baseline Run 2 | N/A | varies | Job `01cbbf9e` (pre-Block-B) |
| Post-change Run 1 | N/A | TBD | pending deploy + smoke |
| Post-change Run 2 | N/A | TBD | pending deploy + smoke |

Expected impact: one fewer Supabase roundtrip per successful evaluation.

## Risks & Anomalies

- Deploy-order risk mitigated by PR split.
- Quality gate anomaly disclosure: none (no gate logic changed).
- Final principle: invalid artifacts remain impossible to persist; partial-write success states are now structurally impossible.

## Verification (local structural)

- Focused tests: 15/15 passing
- Boundary guard: PASS
- Build: PASS (post-change)

## Post-deploy verification

Run:

```bash
npm run jobs:smoke:service-role
```

For a successful job (`<SUCCESS_JOB_ID>`):

```sql
SELECT
  id,
  status,
  phase,
  phase_status,
  validity_status,
  evaluation_result_version,
  completed_at,
  updated_at,
  progress->'gate_enforcement' AS gate_enforcement
FROM evaluation_jobs
WHERE id = '<SUCCESS_JOB_ID>';
```

Expected:
- `status = complete`
- `phase = phase_2`
- `phase_status = complete`
- `gate_enforcement` populated

Artifact existence:

```sql
SELECT
  id,
  job_id,
  manuscript_id,
  artifact_type,
  artifact_version,
  source_hash,
  created_at,
  updated_at
FROM evaluation_artifacts
WHERE job_id = '<SUCCESS_JOB_ID>';
```

Expected:
- one row
- `artifact_type = evaluation_result_v2`
- `artifact_version = evaluation_result_v2`

Also verify Block A failure-path when next phase_1 failure occurs (`<FAILED_PHASE_1_JOB_ID>`):

```sql
SELECT
  id,
  status,
  phase,
  phase_status,
  failure_code,
  progress->'pipeline_failure_envelope' AS pipeline_failure_envelope,
  last_error
FROM evaluation_jobs
WHERE id = '<FAILED_PHASE_1_JOB_ID>';
```

Expected post-deploy:
- `status = failed`
- `phase = phase_1`
- `pipeline_failure_envelope` populated

## Status line for workbook

`ATOMICITY_HARDENING: STRUCTURAL ENFORCED, EMPIRICAL PENDING DEPLOY + MIGRATION APPLY.`

## Rollback

- Revert boundary code to prior sequential success path.
- RPC may remain deployed and unused safely.
