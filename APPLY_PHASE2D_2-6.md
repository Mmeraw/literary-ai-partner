# Phase 2D Migrations 2-6 Application Instructions

**Status:** Migration 1 ✅ applied. Migrations 2-6 need to be applied.

## Quick Summary

These 5 SQL migrations must be applied to your Supabase production database to complete Phase 2D setup:

- **Migration 2**: Fix `claim_job_atomic` RPC
- **Migration 3**: Create `evaluation_provider_calls` table for audit trail
- **Migration 4**: Add idempotency constraint `unique_provider_call_per_job`
- **Migration 5**: Grant execute permissions
- **Migration 6**: Create `renew_lease` RPC for heartbeat renewal

## How to Apply

### Option A: Via Supabase Dashboard (Manual, Fastest)

1. Open [Supabase Console](https://app.supabase.com/projects)
2. Select: **RevisionGrade Production** (xtumxjnzdswuumndcbwc)
3. Go: **SQL Editor** → **New Query**
4. Copy all SQL from `/tmp/phase2d-2-6.sql`:
   ```bash
   cat /tmp/phase2d-2-6.sql
   ```
5. Paste into the query editor
6. Click **Run**
7. Should complete with no errors (or expected NOTICE messages)

### Option B: Via PostgreSQL CLI (If Available)

```bash
# From codespace (if psql installed and credentials available)
psql "postgresql://postgres:password@host/database" < /tmp/phase2d-2-6.sql
```

### Option C: Manual Individual Application

If the combined SQL fails, apply each migration individually in order:

1. **Migration 2**: Copy contents of `supabase/migrations/20260128000002_fix_claim_job_atomic_eval_jobs.sql`
2. **Migration 3**: Copy contents of `supabase/migrations/20260128000003_add_evaluation_provider_calls.sql`
3. **Migration 4**: Copy contents of `supabase/migrations/20260128000004_add_provider_calls_idempotency.sql`
4. **Migration 5**: Copy contents of `supabase/migrations/20260128000005_grant_claim_job.sql`
6. **Migration 6**: Copy contents of `supabase/migrations/20260128000006_add_renew_lease_rpc.sql`

Paste each into the Supabase SQL Editor individually and run.

## What Gets Created

### New RPC Functions
- `claim_job_atomic(worker_id, now, lease_seconds)` - Atomically claims next job with lease
- `renew_lease(job_id, worker_id, lease_token, now, lease_seconds)` - Renews lease with token verification

### New Table
- `evaluation_provider_calls` - Audit table for provider API calls with request/response/error metadata

### New Indexes
- `idx_provider_calls_job_id` - Query by job
- `idx_provider_calls_provider_phase` - Query by provider + phase
- `idx_provider_calls_created_at` - Query by timestamp

### Constraints
- `unique_provider_call_per_job` - Ensures one call per (job_id, provider, phase) tuple

## After Application

Once applied, trigger a new Phase 2D Evidence Gate workflow run:

```bash
# Push a dummy commit to trigger workflow
git commit --allow-empty -m "trigger: Phase 2D Evidence Gate after migrations applied"
git push origin main

# Monitor the run
gh run list --workflow=phase2d-evidence.yml --limit=1
```

The workflow should either:
- ✅ **PASS**: All Phase 2D slices pass → Evidence locked
- ❌ **FAIL**: With specific test logic error → Indicates what needs code fix

## Verification Query

After applying, verify the schema is complete:

```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'evaluation_jobs' 
AND column_name IN ('worker_id', 'lease_until', 'lease_token', 'heartbeat_at', 'started_at')
ORDER BY column_name;

-- Check functions exist  
SELECT proname FROM pg_proc 
WHERE proname IN ('claim_job_atomic', 'renew_lease');

-- Check table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'evaluation_provider_calls';

-- Check constraint exists
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'evaluation_provider_calls' 
AND constraint_name = 'unique_provider_call_per_job';
```

All queries should return results with no errors.
