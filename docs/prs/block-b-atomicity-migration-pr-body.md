## Summary

Adds the `persist_evaluation_v2_atomic` Supabase RPC for atomic V2 evaluation persistence.
This PR introduces the database function only. No application code calls it yet.

## Scope

- Adds migration:
  - `supabase/migrations/20260426210500_persist_evaluation_v2_atomic.sql`
- No TypeScript/runtime code changes.
- No production behavior change until the boundary switch PR lands.

## Contract Integrity

The RPC is designed to replace the current two-write success path:
1. `evaluation_artifacts` upsert
2. `evaluation_jobs` completion update

with one database transaction.

The RPC uses the verified production contract:
- `ON CONFLICT (job_id, artifact_type)`
- service-role-only execution
- `SECURITY DEFINER`
- no public/authenticated/anon execution rights

## Behavioral Quality

- This migration is additive only.
- No existing quality-gate logic or boundary behavior is changed in this PR.
- No caller is wired yet.

## Latency Evidence

Pass selection:
- [ ] Pass 1
- [ ] Pass 2
- [ ] Pass 3 (N/A — migration-only)

| Run | passX_ms | total_ms | Notes |
|-----|---------:|---------:|-------|
| Run 1 | N/A | N/A | Migration-only PR; no pipeline path executes |
| Run 2 | N/A | N/A | Migration-only PR; no pipeline path executes |

## Risks & Anomalies

- Migration-only: runtime risk is low because no deployed path depends on this RPC yet.
- Quality gate anomaly disclosure: none (no evaluation logic changed).
- Final principle: this preserves fail-closed doctrine by introducing the atomic primitive that PR 2 will call at the boundary.

## Verification

After applying migration:

```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'persist_evaluation_v2_atomic';
```

Expected:
- one row
- `prosecdef = true`

Permission check:

```sql
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'persist_evaluation_v2_atomic'
ORDER BY grantee;
```

Expected:
- `service_role` has `EXECUTE`
- `anon` does not
- `authenticated` does not

## Apply steps

- Option A: Supabase Dashboard SQL Editor (paste migration SQL and run)
- Option B: `npx supabase db push`

## Rollback

```sql
DROP FUNCTION IF EXISTS public.persist_evaluation_v2_atomic(
  uuid,
  bigint,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer,
  timestamptz,
  timestamptz,
  timestamptz
);
```
