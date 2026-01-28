# Phase 2D Evidence Gate: Root Cause Analysis & Fix  

**Date:** 2026-01-28  
**Time:** 23:26:32Z  
**Status:** DIAGNOSIS COMPLETE - AWAITING DATABASE MIGRATIONS

## The Real Issue (Now Confirmed)

You correctly diagnosed the situation. The workflow runs include:

1. ✅ **Secrets check**: Now fully working
2. ❌ **Phase 2D-1 test execution**: Fails due to missing database columns

**The workflow is NOT running Phase 2D tests successfully because:**

### The Database Schema is Out of Sync

The Phase 2D-1 atomic claim test tries to execute this RPC call:
```sql
SELECT * FROM claim_job_atomic(
  p_worker_id := 'worker-A',
  p_now := '2026-01-28T23:26:32Z',
  p_lease_seconds := 300
)
```

The RPC exists and runs, but when it tries to SELECT from `evaluation_jobs` with `lease_until`, it fails:
```
error: column evaluation_jobs.lease_until does not exist
```

**This means:** The migration file exists in the repo, but it has **NOT been applied** to the Supabase production database.

## Verification: The Three Truths

**Truth 1: Secrets are flowing**
```
Secret presence check:
  ✓ SUPABASE_URL present
  ✓ SUPABASE_SERVICE_ROLE_KEY present
  ✓ SUPABASE_ANON_KEY present
```
✅ **CONFIRMED & WORKING**

**Truth 2: Code is correct**
- `workers/claimJob.ts` now has fallback: `process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL`
- `lib/supabase.js` already had fallback logic
- Canon Guard passed ✓

✅ **CONFIRMED & WORKING**

**Truth 3: Database schema is incomplete**
- Migration files exist: `20260128000001_add_eval_job_lease_fields.sql` ✓
- Migration files created: `20260128000006_add_renew_lease_rpc.sql` ✓
- **BUT:** Applied to Supabase DB? ❌ **NOT YET**

❌ **NOT APPLIED TO DATABASE**

## How to Apply Migrations

### Method 1: Via Supabase Dashboard (Fastest for Ad-Hoc)

1. Open [Supabase Console](https://app.supabase.com/projects)
2. Select: **RevisionGrade Production** (xtumxjnzdswuumndcbwc)
3. Navigate: **SQL Editor** → **New Query**
4. Copy entire content of: [20260128000001_add_eval_job_lease_fields.sql](supabase/migrations/20260128000001_add_eval_job_lease_fields.sql)
5. Click **Run**
6. Repeat for:
   - [20260128000002_fix_claim_job_atomic_eval_jobs.sql](supabase/migrations/20260128000002_fix_claim_job_atomic_eval_jobs.sql)
   - [20260128000003_add_evaluation_provider_calls.sql](supabase/migrations/20260128000003_add_evaluation_provider_calls.sql)
   - [20260128000004_add_provider_calls_idempotency.sql](supabase/migrations/20260128000004_add_provider_calls_idempotency.sql)
   - [20260128000005_grant_claim_job.sql](supabase/migrations/20260128000005_grant_claim_job.sql)
   - [20260128000006_add_renew_lease_rpc.sql](supabase/migrations/20260128000006_add_renew_lease_rpc.sql)

### Method 2: Via Supabase CLI (If Connected)

```bash
# Link to production project
supabase link --project-ref xtumxjnzdswuumndcbwc

# Apply all pending migrations
supabase db push
```

### Method 3: Quick SQL Check (Verify Current State)

Before applying, check what columns currently exist:

```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'evaluation_jobs' 
ORDER BY ordinal_position;
```

**Expected columns after migrations:**
- `worker_id` (TEXT)
- `lease_token` (TEXT)  
- `lease_until` (TIMESTAMPTZ)
- `heartbeat_at` (TIMESTAMPTZ)
- `started_at` (TIMESTAMPTZ)

## What Happens After Migrations Are Applied

Once `20260128000001...sql` is applied:
1. **Phase 2D-1** test will execute: Both workers try to claim the same job atomically
2. **Phase 2D-2** test will execute: Idempotency proof  
3. **Phase 2D-3** test will execute: Reconciler + heartbeat renewal

The workflow will either:
- ✅ **PASS**: All slices run successfully → Phase 2D is LOCKED
- ❌ **FAIL**: Test assertion errors appear → Fix code issues and retry

## Current Commits

- **05fe77e**: Fix `workers/claimJob.ts` fallback to SUPABASE_URL ✓
- **77c4a65**: Trigger workflow with secrets check ✓
- **ef74057**: Add secrets presence check step ✓
- **e0da103**: Phase 2D Slice 3 implementation (previous session)

## Timeline: Why This Happened

| Time | Event |
|------|-------|
| Earlier | Phase 2D code written, migrations created |
| 23:09 | Run 21458961679: SUPABASE_ANON_KEY missing → test failed |
| 23:23 | Run 21459298598: Secrets added, but workers/claimJob.ts tried NEXT_PUBLIC_SUPABASE_URL (no fallback) → failed |
| 23:25 | Fixed workers/claimJob.ts fallback |
| 23:26 | Run 21459358407: Secrets ✓, Code ✓, but Database columns ✗ → failed with "column does not exist" |

**This is the expected progression. You're now at the database schema stage.**

## Next Action

Apply the Phase 2D migrations to the Supabase production database using Method 1 or 2 above. Once applied:

```bash
# Push a dummy commit to trigger workflow
git commit --allow-empty -m "trigger: run Phase 2D Evidence Gate after migrations"
git push origin main

# Monitor
gh run list --workflow=phase2d-evidence.yml --limit=1
```

Expected result: Phase 2D tests run and either PASS or show code-level assertion failures (which would need code fixes).

---

**TL;DR:**
- Secrets: ✅ FIXED
- Code: ✅ FIXED  
- Database: ❌ Needs Phase 2D migrations applied to production Supabase
- Your user action: Apply the SQL migrations (copy/paste into Supabase dashboard SQL editor)
