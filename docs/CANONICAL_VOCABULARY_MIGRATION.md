# Canonical Vocabulary Migration Guide

**Target:** Fix all violations found by canon audit  
**Timeline:** 2-week phased rollout  
**Risk Level:** Medium (requires DB migration + RLS updates)

## Current State Assessment

Run the audit to see violations:
```bash
./scripts/canon-audit-banned-aliases.sh
```

**Expected violations:**
- `phase1`/`phase2` in ~40+ files (scripts, lib, app)
- `progress.stage` in phase1.ts, phase2.ts, jobStore.supabase.ts
- Possibly `owner_id`/`author_id` in some RLS policies

---

## Migration Path: Phase-by-Phase

### Week 1: Foundation + Type System (Non-Breaking)

#### Day 1: Setup Infrastructure ✅
- [x] Created `lib/jobs/canon.ts` with normalizers
- [x] Updated `scripts/canon-audit-banned-aliases.sh` with tiered scanning
- [x] Created `docs/CANONICAL_VOCABULARY.md` governance

**Next:** Run initial audit baseline
```bash
./scripts/canon-audit-banned-aliases.sh > audit-baseline.txt 2>&1
```

#### Day 2-3: Update Type System

**Files to modify:**

1. **lib/jobs/types.ts**
   ```typescript
   // Replace this:
   export type Phase = "phase1" | "phase2";
   
   // With this:
   import { CanonicalPhase } from './canon';
   export type Phase = CanonicalPhase;
   ```

2. **lib/jobs/store.ts** (line 67)
   ```typescript
   // Replace:
   phase: "phase1" | "phase2",
   
   // With:
   import { CanonicalPhase } from './canon';
   phase: CanonicalPhase,
   ```

3. **lib/ui/phase-helpers.ts**
   ```typescript
   // Replace all "phase1" | "phase2" with:
   import { CanonicalPhase, toDisplayPhase } from '@/lib/jobs/canon';
   
   // Update functions to accept CanonicalPhase
   // Use toDisplayPhase() for UI rendering
   ```

4. **lib/jobs/ui-helpers.ts**
   ```typescript
   // Same pattern: import CanonicalPhase, update type signatures
   ```

**Verification:**
```bash
npm run type-check
# Should pass with no errors
```

#### Day 4-5: Add Normalization Layer (Defensive Reads)

**Wrap all database reads:**

1. **lib/jobs/jobStore.supabase.ts**
   ```typescript
   import { toCanonicalPhase, migrateProgressStageToPhaseStatus } from './canon';
   
   export async function getJob(jobId: string): Promise<Job | null> {
     const { data, error } = await supabase
       .from('evaluation_jobs')
       .select('*')
       .eq('id', jobId)
       .single();
   
     if (error || !data) return null;
   
     // Normalize on read (defensive against legacy data)
     return {
       ...data,
       phase: toCanonicalPhase(data.phase),
       progress: migrateProgressStageToPhaseStatus(data.progress),
     };
   }
   ```

2. **Apply to all read functions:**
   - `getJob()`
   - `listJobs()`
   - `listJobsForManuscript()`
   - `acquireLeaseForPhase1()` / `acquireLeaseForPhase2()`

**Test in dev:**
```bash
npm run dev
# Create a job, verify it displays correctly
# Check browser console for migration warnings
```

---

### Week 2: Storage Writes + Data Migration (Breaking)

#### Day 6-7: Update Storage Writes (Canonical Only)

**Files to modify:**

1. **lib/jobs/phase1.ts**
   ```typescript
   import { CANONICAL_PHASE, CANONICAL_PHASE_STATUS } from './canon';
   
   // Replace all instances:
   progress: {
     phase: CANONICAL_PHASE.PHASE_1,           // was: "phase1"
     phase_status: CANONICAL_PHASE_STATUS.RUNNING,  // was: stage: "processing"
     // ... rest of progress
   }
   ```

2. **lib/jobs/phase2.ts**
   ```typescript
   // Same pattern: replace "phase2" with CANONICAL_PHASE.PHASE_2
   // Replace progress.stage with progress.phase_status
   ```

3. **lib/jobs/jobStore.supabase.ts**
   ```typescript
   // In createJob(), acquireLease*, etc:
   phase: CANONICAL_PHASE.PHASE_1,  // was: "phase_1" (already close!)
   
   progress: {
     phase_status: CANONICAL_PHASE_STATUS.PENDING,  // was: stage: "queued"
     // ...
   }
   ```

**Critical:** Remove all `progress.stage` assignments. Replace with `progress.phase_status`.

#### Day 8: Database Migration (Staging First)

**Migration 1: Normalize `phase` column**

```sql
-- File: supabase/migrations/20260126000000_normalize_phase_values.sql

-- Step 1: Add temporary column
ALTER TABLE evaluation_jobs ADD COLUMN phase_canonical TEXT;

-- Step 2: Migrate data
UPDATE evaluation_jobs
SET phase_canonical = CASE
  WHEN phase = 'phase1' THEN 'phase_1'
  WHEN phase = 'phase2' THEN 'phase_2'
  WHEN phase = 'phase_1' THEN 'phase_1'  -- already canonical
  WHEN phase = 'phase_2' THEN 'phase_2'  -- already canonical
  ELSE phase
END
WHERE phase IS NOT NULL;

-- Step 3: Verify (must return 0)
SELECT COUNT(*) FROM evaluation_jobs
WHERE phase_canonical IS NOT NULL 
  AND phase_canonical NOT IN ('phase_0', 'phase_1', 'phase_2');

-- Step 4: Swap columns (only if verification passes)
ALTER TABLE evaluation_jobs DROP COLUMN phase;
ALTER TABLE evaluation_jobs RENAME COLUMN phase_canonical TO phase;

-- Step 5: Add check constraint
ALTER TABLE evaluation_jobs
ADD CONSTRAINT phase_canonical_values 
CHECK (phase IS NULL OR phase IN ('phase_0', 'phase_1', 'phase_2'));

COMMENT ON COLUMN evaluation_jobs.phase IS 
  'Canonical phase values: phase_0|phase_1|phase_2. See docs/CANONICAL_VOCABULARY.md';
```

**Migration 2: Migrate `progress.stage` → `progress.phase_status`**

```sql
-- File: supabase/migrations/20260126000001_migrate_progress_stage.sql

-- Use jsonb operators to rename nested key
UPDATE evaluation_jobs
SET progress = progress - 'stage' || jsonb_build_object('phase_status', 
  CASE 
    WHEN progress->>'stage' = 'starting' THEN 'pending'
    WHEN progress->>'stage' = 'processing' THEN 'running'
    WHEN progress->>'stage' = 'complete' THEN 'complete'
    WHEN progress->>'stage' = 'completed' THEN 'complete'
    WHEN progress->>'stage' = 'failed' THEN 'failed'
    WHEN progress->>'stage' = 'phase2_error' THEN 'failed'
    ELSE progress->>'stage'
  END
)
WHERE progress ? 'stage';

-- Verify no jobs still have progress.stage
SELECT id, progress->'stage' FROM evaluation_jobs
WHERE progress ? 'stage';
-- Should return 0 rows

COMMENT ON COLUMN evaluation_jobs.progress IS
  'Job progress metadata. Must use phase_status (not stage). See docs/CANONICAL_VOCABULARY.md';
```

**Deploy to staging:**
```bash
# Apply migrations
npx supabase db push --db-url $STAGING_DATABASE_URL

# Verify data
psql $STAGING_DATABASE_URL -c "SELECT DISTINCT phase FROM evaluation_jobs;"
# Should only see: phase_1, phase_2, or NULL

psql $STAGING_DATABASE_URL -c "SELECT COUNT(*) FROM evaluation_jobs WHERE progress ? 'stage';"
# Should be: 0
```

#### Day 9: Update External API Endpoints (Deprecation)

**Option A: Keep legacy endpoints, translate internally**

In `app/api/jobs/[id]/run-phase1/route.ts`:
```typescript
import { CANONICAL_PHASE } from '@/lib/jobs/canon';

export async function POST(req, { params }) {
  // Translate phase1 → phase_1 internally
  return runPhase(params.id, CANONICAL_PHASE.PHASE_1);
}
```

**Option B: Create new unified endpoint**

Create `app/api/jobs/[id]/run/route.ts`:
```typescript
import { toCanonicalPhase } from '@/lib/jobs/canon';

export async function POST(req, { params }) {
  const { phase } = await req.json();
  const canonical = toCanonicalPhase(phase);
  
  if (!canonical) {
    return Response.json({ error: 'Invalid phase' }, { status: 400 });
  }
  
  return runPhase(params.id, canonical);
}
```

Update scripts to use new endpoint:
```javascript
// scripts/worker-daemon.mjs
- fetch(`${BASE_URL}/api/jobs/${jobId}/run-phase1`)
+ fetch(`${BASE_URL}/api/jobs/${jobId}/run`, {
+   body: JSON.stringify({ phase: 'phase_1' })
+ })
```

#### Day 10: Update All Scripts

**Scripts to fix (~15 files):**
- `scripts/worker-daemon.mjs`
- `scripts/jobs-smoke.mjs`
- `scripts/jobs-test-cancel.mjs`
- `scripts/jobs-lease-contention-test.mjs`
- `scripts/test-phase2-idempotency.sh`
- etc.

**Pattern:**
```javascript
// Replace:
if (job.progress.phase === "phase1") { ... }

// With:
if (job.progress.phase === "phase_1") { ... }
```

**Automated fix:**
```bash
# Dry run first
find scripts -name "*.mjs" -o -name "*.sh" | xargs sed -n 's/phase1/phase_1/gp'

# Apply
find scripts -name "*.mjs" -o -name "*.sh" | xargs sed -i 's/"phase1"/"phase_1"/g'
find scripts -name "*.mjs" -o -name "*.sh" | xargs sed -i 's/"phase2"/"phase_2"/g'
find scripts -name "*.mjs" -o -name "*.sh" | xargs sed -i "s/'phase1'/'phase_1'/g"
find scripts -name "*.mjs" -o -name "*.sh" | xargs sed -i "s/'phase2'/'phase_2'/g"
```

---

## Testing Checklist

After each migration step, verify:

### Type Safety
```bash
npm run type-check
# No TypeScript errors
```

### Unit Tests
```bash
npm test
# All tests pass
```

### Integration Tests
```bash
# Create a new job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 123, "job_type": "evaluate_full"}'

# Verify job has canonical phase
curl http://localhost:3000/api/jobs/{job_id} | jq '.phase'
# Should show: "phase_1" (not "phase1")

# Run phase 1
curl -X POST http://localhost:3000/api/jobs/{job_id}/run \
  -H "Content-Type: application/json" \
  -d '{"phase": "phase_1"}'

# Check progress uses phase_status
curl http://localhost:3000/api/jobs/{job_id} | jq '.progress.phase_status'
# Should show: "running" (not stage: "processing")
```

### Canon Audit
```bash
./scripts/canon-audit-banned-aliases.sh
# Should pass with zero errors in storage layer
```

---

## Rollback Plan

If migration causes issues in production:

### Rollback DB Migration
```sql
-- Revert phase column
ALTER TABLE evaluation_jobs ADD COLUMN phase_legacy TEXT;
UPDATE evaluation_jobs SET phase_legacy = 
  CASE phase
    WHEN 'phase_1' THEN 'phase1'
    WHEN 'phase_2' THEN 'phase2'
    ELSE phase
  END;
ALTER TABLE evaluation_jobs DROP COLUMN phase;
ALTER TABLE evaluation_jobs RENAME COLUMN phase_legacy TO phase;

-- Revert progress.phase_status → progress.stage
UPDATE evaluation_jobs
SET progress = progress - 'phase_status' || jsonb_build_object('stage', progress->>'phase_status')
WHERE progress ? 'phase_status';
```

### Rollback Code
```bash
git revert <migration-commit-hash>
npm run build
# Redeploy previous version
```

---

## Success Criteria

Migration is complete when:

1. ✅ `./scripts/canon-audit-banned-aliases.sh` passes (zero errors)
2. ✅ All TypeScript builds without errors
3. ✅ All tests pass
4. ✅ Database query: `SELECT DISTINCT phase FROM evaluation_jobs;` returns only canonical values
5. ✅ Database query: `SELECT COUNT(*) FROM evaluation_jobs WHERE progress ? 'stage';` returns 0
6. ✅ UI displays jobs correctly (no broken phase labels)
7. ✅ Worker daemon processes jobs without errors
8. ✅ No console warnings about legacy value normalization (after migration window)

---

## Post-Migration Cleanup

After 30 days of stable operation:

1. Remove normalization helpers from `jobStore.supabase.ts` (reads are now always canonical)
2. Remove legacy endpoint support (`/run-phase1`, `/run-phase2`)
3. Remove `toCanonicalPhase()` calls from read paths (data is now guaranteed canonical)
4. Add production validation:
   ```typescript
   import { validateProgressSchema } from './canon';
   
   // In all write paths:
   validateProgressSchema(progress);  // Throws if non-canonical
   ```

---

## Questions / Blockers?

If you encounter:
- **RLS failures:** Check [docs/CANONICAL_VOCABULARY.md](./CANONICAL_VOCABULARY.md#rls-rewrite-protocol)
- **Type errors:** Ensure all imports use `CanonicalPhase` from `lib/jobs/canon.ts`
- **Script failures:** Check if script is using legacy string literals (search for `"phase1"`)
- **UI broken:** Verify you're using `toDisplayPhase()` for rendering, not raw canonical values

Document any blockers in [GitHub Issues](https://github.com/Mmeraw/literary-ai-partner/issues) with label `canonical-migration`.
