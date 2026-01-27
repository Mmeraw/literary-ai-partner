# Remote Migration & Phase 2 Fixes - Complete

## Summary

Fixed the Phase 2 vertical slice failures by identifying and addressing the root cause: **remote Supabase database missing the `job_id` column migration**.

## Root Cause Analysis

1. **Phase 1 writes chunks successfully** to remote Supabase (5/5 chunks created)
2. **Phase 1 code already passes `jobId`** to `ensureChunks()` → `upsertChunks()` 
3. **Remote database missing `job_id` column** - PostgreSQL error 42703 confirmed
4. **Phase 2 fallback to time-bounded query** returns 0 rows (chunks exist but created outside time window or wrong manuscript)
5. **Validation guard correctly rejects** 0 chunks when expecting 5 (preventing silent errors)

## Changes Applied

### 1. Remote Migration Instructions (`scripts/apply-remote-migration.md`)
- SQL to add `job_id UUID` column to `manuscript_chunks`  
- Composite indexes for efficient Phase 2 queries
- Optional backfill SQL for production data
- Verification queries

### 2. Phase 2 Strict Enforcement (`lib/manuscripts/chunks.ts`)
**Before:** Fallback silently returns empty array when job_id query fails  
**After:**
- Throw error if `jobId` is null/empty (no silent failures)
- Add console.warn when job_id column missing (visibility)
- Strict validation: throw if 0 chunks found when expecting N chunks  
- Better error messages: "No chunks found for job_id=X, expected N chunks. Verify Phase 1 wrote job_id."

```typescript
// STRICT ENFORCEMENT: Phase 2 requires chunks to exist
if (chunks.length === 0 && expectedChunkCount && expectedChunkCount > 0) {
  throw new Error(
    `No chunks found for job_id=${jobId}, manuscript_id=${manuscriptId}. ` +
    `Expected ${expectedChunkCount} chunks. Verify Phase 1 wrote job_id to chunks.`
  );
}
```

### 3. Phase 1 Validation (`lib/jobs/phase1.ts`)
Added post-insert validation to verify chunks have `job_id`:

```typescript
// VALIDATION: Verify chunks were created with job_id
const jobLinkedChunks = allChunks.filter(c => c.job_id === jobId);
if (jobLinkedChunks.length === 0) {
  console.warn(`[Phase1] WARNING: No chunks found with job_id=${jobId}...`);
} else if (jobLinkedChunks.length !== chunkCount) {
  console.warn(`[Phase1] WARNING: Expected ${chunkCount} chunks with job_id=${jobId}, found ${jobLinkedChunks.length}`);
} else {
  console.log(`[Phase1] ✓ Verified ${jobLinkedChunks.length} chunks linked to job ${jobId}`);
}
```

This surfaces migration issues immediately in Phase 1 logs instead of failing silently in Phase 2.

### 4. Test Script Port Flexibility (`scripts/test-phase2-vertical-slice.sh`)
**Before:** Hardcoded to check ports 3002/3000  
**After:** Supports `BASE_URL` environment variable

```bash
# Use custom port:
BASE_URL=http://localhost:3015 bash scripts/test-phase2-vertical-slice.sh

# Or auto-detect (fallback behavior):
bash scripts/test-phase2-vertical-slice.sh
```

All `http://localhost:$DEV_PORT` references replaced with `$BASE_URL` variable.

### 5. Migration Verification Script (`scripts/verify-remote-migration.sh`)
Quick check to confirm migration was applied:

```bash
bash scripts/verify-remote-migration.sh
```

Output:
- ✓ job_id column exists  
- Sample data with job_id values
- Warning if legacy NULL job_ids found
- Clear error message if migration missing

## Next Steps

### IMMEDIATE: Apply Remote Migration

1. **Open Supabase SQL Editor:**  
   https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/sql/new

2. **Run this SQL:**
   ```sql
   ALTER TABLE public.manuscript_chunks 
     ADD COLUMN IF NOT EXISTS job_id UUID NULL;

   CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_job_id 
     ON public.manuscript_chunks(job_id) 
     WHERE job_id IS NOT NULL;

   CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_manuscript_job 
     ON public.manuscript_chunks(manuscript_id, job_id) 
     WHERE job_id IS NOT NULL;
   ```

3. **Verify migration:**
   ```bash
   bash scripts/verify-remote-migration.sh
   ```

4. **Clean test data (optional):**
   ```sql
   DELETE FROM manuscript_chunks WHERE manuscript_id = 1;
   ```

### THEN: Re-run Vertical Slice Test

With clean server on port 3015:

```bash
BASE_URL=http://localhost:3015 bash scripts/test-phase2-vertical-slice.sh
```

Expected outcome:
- Phase 1: Creates 5 chunks with job_id populated
- Phase 1 validation: "✓ Verified 5 chunks linked to job <uuid>"  
- Phase 2: Queries by job_id, finds 5 chunks
- Phase 2: Aggregates chunks, persists artifact
- Test: "✓✓✓ ALL TESTS PASSED"

### Expected Next Failure (after job_id fix)

Based on previous run, you may encounter:
```
Failed to persist Phase 2 artifact: Could not find 'artifact_version' column
```

**Diagnosis:** Check if `evaluation_artifacts.artifact_version` column exists on remote.

**Fix:** Verify schema matches local:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'evaluation_artifacts' 
  AND column_name = 'artifact_version';
```

If missing, apply the `evaluation_artifacts` migration to remote.

## Files Changed

- `lib/manuscripts/chunks.ts` - Strict job_id enforcement  
- `lib/jobs/phase1.ts` - Post-insert validation
- `scripts/test-phase2-vertical-slice.sh` - BASE_URL support
- `scripts/apply-remote-migration.md` - Migration instructions (new)
- `scripts/verify-remote-migration.sh` - Verification script (new)

## Contract Compliance

All changes follow RevisionGrade governance:
- No invented job statuses or types
- Canonical job state transitions preserved
- Validation guards prevent silent errors
- Observability via console logs (passive only)
- Fail explicitly rather than guess

## Proof Commands

```bash
# 1. Verify code changes
git diff lib/manuscripts/chunks.ts lib/jobs/phase1.ts scripts/test-phase2-vertical-slice.sh

# 2. Check migration file exists locally
cat supabase/migrations/20260124000001_add_job_id_to_chunks.sql

# 3. Verify remote needs migration
bash scripts/verify-remote-migration.sh
# Expected: ✗ MIGRATION NOT APPLIED (before manual SQL run)

# 4. After manual SQL run
bash scripts/verify-remote-migration.sh
# Expected: ✓✓✓ MIGRATION VERIFIED

# 5. Run vertical slice
BASE_URL=http://localhost:3015 bash scripts/test-phase2-vertical-slice.sh
```

---

**Status:** Code changes complete. Waiting for manual remote migration before testing can proceed.
