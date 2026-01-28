# Phase 2D Evidence Gate - Diagnostic Update

**Report Date:** 2026-01-28T23:26:32Z  
**Current Status:** SECRETS ✅ FIXED → DATABASE ❌ SCHEMA MISMATCH  
**Latest Run:** 21459358407

## Progress Report

### ✅ Secrets Issue: RESOLVED
The secrets flow issue has been **completely resolved**:
- **SUPABASE_URL**: ✓ Present
- **SUPABASE_SERVICE_ROLE_KEY**: ✓ Present  
- **SUPABASE_ANON_KEY**: ✓ Present (now working!)
- **workers/claimJob.ts** fallback: ✓ Fixed (now falls back to SUPABASE_URL)

The workflow successfully connected to Supabase and executed the RPC.

### ❌ New Issue: Database Schema Mismatch
The Phase 2D tests are now **failing due to missing database columns**, not secrets:

**Error:**
```
column evaluation_jobs.lease_until does not exist
```

**Root cause:** 
The Supabase database in the production project (`xtumxjnzdswuumndcbwc`) has not had the Phase 2D migrations applied.

**Migrations required:**
1. `20260128000004_add_atomic_claim_rpc.sql` - Creates `claim_job_atomic` RPC
2. `20260128000005_add_renew_lease_rpc.sql` - Creates `renew_lease` RPC
3. Migration that adds columns to `evaluation_jobs`:
   - `worker_id` (UUID)
   - `lease_token` (UUID)
   - `lease_until` (timestamp)
   - `heartbeat_at` (timestamp)

## Current Workflow Status

**Run 21459358407 Timeline:**
1. Checkout ✓
2. Setup Node.js ✓
3. Install dependencies ✓
4. Verify secrets are present ✓ (all critical ones detected)
5. Run Phase 2D Evidence ✗
   - Schema check: ✗ Missing columns
   - Test execution: `Expected length: 1, Received length: 0`
     - Both `claimNextJob('worker-A')` and `claimNextJob('worker-B')` returned `null`
     - This is because the RPC couldn't find/update the job due to missing columns

## Next Steps: Apply Migrations

### Option 1: Manual via Supabase Dashboard (Quickest)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select project: **RevisionGrade Production** (`xtumxjnzdswuumndcbwc`)
3. Go to **SQL Editor** → **New Query**
4. Copy and paste the migration files in order:
   - [supabase/migrations/20260128000004_add_atomic_claim_rpc.sql](supabase/migrations/20260128000004_add_atomic_claim_rpc.sql)
   - [supabase/migrations/20260128000005_add_renew_lease_rpc.sql](supabase/migrations/20260128000005_add_renew_lease_rpc.sql)
5. Click **Run** for each

### Option 2: Via Supabase CLI (If Configured)
```bash
# Ensure you have the correct project linked
supabase link --project-ref xtumxjnzdswuumndcbwc

# Apply migrations
supabase db push
```

### Option 3: Verify Migration Files Exist
First, confirm all necessary migration files are in place:

```bash
ls -la supabase/migrations/202601280000*.sql
```

Expected files:
- `20260128000004_add_atomic_claim_rpc.sql`
- `20260128000005_add_renew_lease_rpc.sql`

## Schema Requirements

The `evaluation_jobs` table must have these columns (from Phase 2D):
```sql
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS worker_id UUID;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS lease_token UUID;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS lease_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE evaluation_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
```

Plus indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status_lease 
ON evaluation_jobs(status, lease_until);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_worker_id 
ON evaluation_jobs(worker_id);
```

## After Applying Migrations

1. Trigger the workflow again:
   ```bash
   git push origin main
   ```

2. Monitor the new run:
   ```bash
   gh run list --workflow=phase2d-evidence.yml --limit=1
   ```

3. Expected next failures (if any):
   - Idempotency checks (Phase 2D-2)
   - Reconciler + heartbeat (Phase 2D-3)

## Summary

- **Secrets**: ✅ ALL WORKING
- **Code**: ✅ FALLBACK FIXED  
- **Database**: ❌ NEEDS MIGRATIONS APPLIED
- **Next Action**: Apply Phase 2D migrations to Supabase production database

Once migrations are applied, Phase 2D Evidence Gate should execute all 3 slices and report results.
