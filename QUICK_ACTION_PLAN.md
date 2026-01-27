# Quick Action Plan: Get Phase 2 to Green

## Current Situation
✅ Code fixed and ready  
✅ Local migration exists (`20260124000001_add_job_id_to_chunks.sql`)  
✅ Phase 1 already writes `job_id` to chunks  
✅ Phase 2 will strictly validate chunks have `job_id`  
✅ Test script supports custom port (BASE_URL)  
✅ Clean dev server running on port 3015  
❌ **Remote Supabase missing `job_id` column** (blocking Phase 2)

## Step-by-Step: Get to Green NOW

### 1. Apply Remote Migration (1 minute)

Open: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/sql/new

Paste and run:
```sql
ALTER TABLE public.manuscript_chunks ADD COLUMN IF NOT EXISTS job_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_job_id ON public.manuscript_chunks(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_manuscript_job ON public.manuscript_chunks(manuscript_id, job_id) WHERE job_id IS NOT NULL;
```

### 2. Verify Migration Applied

```bash
bash scripts/verify-remote-migration.sh
```

Expected output:
```
✓ job_id column EXISTS on remote Supabase
✓✓✓ MIGRATION VERIFIED - Phase 2 can now use job_id filtering
```

### 3. Clean Test Data (optional but recommended)

In Supabase SQL editor:
```sql
DELETE FROM manuscript_chunks WHERE manuscript_id = 1;
```

This ensures no legacy chunks without `job_id` interfere with the test.

### 4. Run Vertical Slice Test

```bash
BASE_URL=http://localhost:3015 bash scripts/test-phase2-vertical-slice.sh
```

Expected flow:
1. Creates job  
2. Daemon picks it up  
3. Phase 1: Creates 5 chunks with `job_id` populated  
4. Phase 1 logs: `✓ Verified 5 chunks linked to job <uuid>`  
5. Phase 2: Queries by `job_id`, finds 5 chunks  
6. Phase 2: Aggregates and persists artifact  
7. Test passes: `✓✓✓ ALL TESTS PASSED`

## If Phase 2 Still Fails

### Error: "No chunks found for job_id=..."
**Cause:** Phase 1 didn't write `job_id` (column didn't exist during insert)  
**Fix:** Chunks were created before migration - delete them and re-run test

```sql
DELETE FROM manuscript_chunks WHERE manuscript_id = 1;
```

### Error: "artifact_version does not exist"
**Cause:** Remote missing `evaluation_artifacts.artifact_version` column  
**Fix:** Check column exists:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'evaluation_artifacts' 
  AND column_name = 'artifact_version';
```

If missing, apply migration `20260124000000_evaluation_artifacts.sql` to remote.

### Error: 403 Forbidden
**Cause:** SUPABASE_SERVICE_ROLE_KEY not set or wrong  
**Fix:** Verify env var:

```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log({key: process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0,20) + '...'})"
```

## What Changed

### Code (already applied):
- `lib/manuscripts/chunks.ts` - Strict job_id enforcement, fail fast on 0 chunks
- `lib/jobs/phase1.ts` - Validation after chunk insert (warns if job_id missing)
- `scripts/test-phase2-vertical-slice.sh` - Supports `BASE_URL` env var

### New Files:
- `scripts/apply-remote-migration.md` - Detailed migration instructions
- `scripts/verify-remote-migration.sh` - Quick migration verification
- `REMOTE_MIGRATION_COMPLETE.md` - Full technical summary
- `QUICK_ACTION_PLAN.md` - This file

## Proof of Readiness

```bash
# Code is ready:
grep -n "job_id === jobId" lib/jobs/phase1.ts          # Validation present
grep -n "No chunks found for job_id" lib/manuscripts/chunks.ts  # Strict check present
grep -n "BASE_URL" scripts/test-phase2-vertical-slice.sh        # Port flexibility present

# Migration ready:
cat supabase/migrations/20260124000001_add_job_id_to_chunks.sql  # Local migration exists

# Remote needs migration:
bash scripts/verify-remote-migration.sh  # Shows: ✗ MIGRATION NOT APPLIED
```

## Timeline Estimate

- Apply migration: **1 minute**  
- Verify migration: **10 seconds** (`bash scripts/verify-remote-migration.sh`)  
- Clean test data: **10 seconds** (SQL DELETE)  
- Run test: **30-60 seconds** (depending on LLM mock)  

**Total: ~2-3 minutes from migration to green**

## Success Criteria

✅ Migration verified with `scripts/verify-remote-migration.sh`  
✅ Phase 1 logs show: "✓ Verified N chunks linked to job <uuid>"  
✅ Phase 2 completes without "fallback" warnings  
✅ Artifact persisted with proper structure  
✅ Test script outputs: "✓✓✓ ALL TESTS PASSED"  

---

**Ready to execute:** All code changes done. Only blocker is manual SQL run (Step 1).
