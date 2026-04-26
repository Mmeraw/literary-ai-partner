## Summary

Resolves a column-name ambiguity in the `persist_evaluation_v2_atomic` RPC that caused V2 atomic persistence calls to fail with:

`column reference "job_id" is ambiguous`

The function declares `RETURNS TABLE (job_id uuid, ...)`. Inside `INSERT ... ON CONFLICT (job_id, artifact_type)`, PostgreSQL could not determine whether `job_id` referred to the OUT parameter or the table column. This hotfix adds `#variable_conflict use_column` so PL/pgSQL prefers column references when names collide.

## Production Status

This hotfix was applied directly to the production database prior to this PR.
This PR exists solely to align source control with the already-correct production state.
No additional migration execution is required.

## Scope

- Adds `supabase/migrations/20260426221500_fix_persist_evaluation_v2_atomic_ambiguity.sql`
- Adds this PR body artifact under `docs/prs/`
- No application code changes
- No schema changes
- Function body adjustment only

## Contract Integrity

- Function signature unchanged.
- Return shape unchanged.
- `ON CONFLICT (job_id, artifact_type)` still matches existing `unique_job_artifact`.
- `SECURITY DEFINER` unchanged.
- `service_role` EXECUTE grant unchanged.
- Atomicity guarantee preserved: artifact upsert + job completion remain in one transaction.

## Behavioral Quality

- Quality gate logic untouched.
- Boundary ownership unchanged.
- `persistEvaluationResultV2` remains the caller.
- Layering doctrine intact: pipeline produces, boundary persists, boundary validates first.
- Principle held: not reducing intelligence; restoring intended atomic-write behavior.

## Latency Evidence

Pass selection:
- [ ] Pass 1
- [ ] Pass 2
- [x] Pass 3

### Baseline (Pre-change)

| Run | pass3_ms | total_ms | Notes |
|-----|---------:|---------:|-------|
| Baseline Run 1 | N/A | N/A | Pre-hotfix: atomic persistence failed at RPC |
| Baseline Run 2 | N/A | N/A | Pre-hotfix: 3 consecutive failures with same error |

### Post-change Runs

| Post-change Run 1 | N/A | ~3:00 | Job 29089ed6, manuscript 5800, completed cleanly |
| Post-change Run 2 | N/A | TBD | Pending next smoke |

Pass 3 divergence distribution (`criteria_count_by_state`):

```json
{
  "criteria_count_by_state": {
    "SCORABLE": "unchanged (hotfix does not alter scoring paths)",
    "NON_SCORABLE": "unchanged (hotfix does not alter scoring paths)"
  }
}
```

## Empirical Evidence

- Job ID: `29089ed6-0fc7-485b-a699-56498b950295`
- Manuscript: `5800`
- Terminal state: `status=complete`, `phase=phase_2`, `phase_status=complete`
- Artifact ID: `af699bd8-1618-4971-a097-b4345f3e7733`
- Artifact type: `evaluation_result_v2`
- `gate_enforcement` populated with canonical PASS fields

**Atomicity Proof — single-transaction signature**

```txt
completed_at:      2026-04-26T22:23:39.34+00:00
artifact.created:  2026-04-26T22:23:39.34+00:00
artifact.updated:  2026-04-26T22:23:39.34+00:00
```

All timestamps are identical, confirming artifact write and job completion occurred within the same transaction boundary.

## Risks & Anomalies

- Source-vs-DB divergence acknowledged: production DB was hotfixed before this PR.
- Merging this PR aligns source control with production state.
- No re-apply risk: migration uses `CREATE OR REPLACE FUNCTION`.
- No deploy-ordering dependency.
- Quality gate anomaly disclosure: none. Gate logic is untouched.
- Final principle: this restores the atomic-write contract established by PR #241 and PR #242.

## Verification

```sql
SELECT pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'persist_evaluation_v2_atomic'
ORDER BY p.oid DESC
LIMIT 1;
```

Expected: function definition contains `#variable_conflict use_column`.

```sql
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'persist_evaluation_v2_atomic'
ORDER BY grantee;
```

Expected: `service_role` has EXECUTE; `anon` and `authenticated` do not.

## Rollback

Rollback would mean restoring the pre-hotfix function body from `20260426210500_persist_evaluation_v2_atomic.sql`.
Practically: do not roll back. The pre-hotfix state was broken because atomic persistence failed closed.

## Closes

- Resolves production atomicity blocker discovered during Block B empirical verification.
- Aligns source control with production DB state.
