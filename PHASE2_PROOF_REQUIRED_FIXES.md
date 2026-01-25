# Phase 2 Eligibility and Vertical Slice Proof

## 1. Phase 2 Eligibility Predicate (Exact Code)

**File:** `app/api/internal/jobs/route.ts`  
**Function:** `GET` handler, lines 44-48

```typescript
const phase2Candidates = allJobs.filter(j => 
  j.status === "running" &&
  j.progress?.phase === "phase1" &&
  j.progress?.phase_status === "complete"
);
```

**SQL/Filter Logic:**
- No SQL involved - filters in-memory from `getAllJobs()` result
- `getAllJobs()` queries `evaluation_jobs` table via Supabase
- Filter checks: job still running + Phase 1 marked complete + not terminal

**Alignment Check:**
- ✅ `progress.phase_status === "complete"` ← Phase 1 completion marker
- ❌ **DOES NOT CHECK** Phase 1 output presence in `manuscript_chunks.result_json`
- ✅ Job not terminal (status must be "running")

**Issue:** Eligibility predicate trusts job progress metadata but doesn't verify chunk output exists.

---

## 2. Phase-1 → Phase-2 Linkage (CRITICAL ISSUE)

### Question: "Given job_id, how do I find the correct chunk rows?"

**Answer:** **YOU CAN'T** - `manuscript_chunks` has NO `job_id` column.

### Current Schema
```sql
-- manuscript_chunks table (from 20260122000000_manuscript_chunks.sql)
CREATE TABLE manuscript_chunks (
  id uuid PRIMARY KEY,
  manuscript_id integer NOT NULL,  -- ← Only manuscript linkage
  chunk_index integer NOT NULL,
  content text NOT NULL,
  result_json jsonb NULL,          -- Phase 1 output
  status chunk_status,
  -- ... NO job_id column
);
```

**Unique constraint:** `UNIQUE(manuscript_id, chunk_index)` (implied by upsert logic)

### The Problem
Phase 2 aggregates like this:
```typescript
const chunks = await getManuscriptChunks(manuscriptId);  // All chunks for manuscript
const completed = chunks.filter(c => c.status === "done" && c.result_json);
```

**This aggregates chunks from ALL job runs on that manuscript**, not just the current job.

### Example Failure Scenario
1. Job A (job_id=1) processes manuscript 100 → writes `manuscript_chunks` with 10 chunks
2. Job A completes, Phase 2 creates artifact
3. Author edits manuscript → new chunks upserted (12 chunks now)
4. Job B (job_id=2) starts Phase 1 for manuscript 100
5. Job B Phase 1 completes 8 chunks, 4 fail
6. **Phase 2 for Job B aggregates ALL 12 chunks** (including stale ones from Job A)

**Result:** Phase 2 artifact for Job B contains data from Job A's run.

---

## 3. Artifact Table DDL Verification

**File:** `supabase/migrations/20260124000000_evaluation_artifacts.sql`

```sql
CREATE TABLE public.evaluation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,                          -- ✅ Required
  manuscript_id BIGINT NOT NULL,
  artifact_type TEXT NOT NULL,                   -- ✅ Required
  artifact_version TEXT NOT NULL DEFAULT 'v1',
  content JSONB NOT NULL,                        -- ✅ Required (JSONB)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- ✅ Required
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_phase TEXT NOT NULL DEFAULT 'phase2',
  source_hash TEXT,
  
  CONSTRAINT unique_job_artifact UNIQUE(job_id, artifact_type)  -- ✅ Required
);
```

**Comparison to Requirements:**
| Requirement | Actual | Status |
|-------------|--------|--------|
| `job_id uuid not null` | `job_id TEXT NOT NULL` | ⚠️ **Type mismatch** (TEXT vs UUID) |
| `artifact_type text not null` | ✅ | Pass |
| `content jsonb not null` | ✅ | Pass |
| `created_at timestamptz default now()` | ✅ | Pass |
| `UNIQUE(job_id, artifact_type)` | ✅ | Pass |

**Issue:** `job_id` is TEXT but should be UUID to match `evaluation_jobs.id` type.

---

## 4. Phase 2 Write Path (Not Truly Idempotent)

**Current Implementation** (`lib/jobs/phase2.ts` lines 150-185):
```typescript
const { data, error } = await supabase
  .from("evaluation_artifacts")
  .upsert(artifact, {
    onConflict: "job_id,artifact_type",
    ignoreDuplicates: true  // Translates to ON CONFLICT DO NOTHING
  })
  .select();

// Check if insert was skipped
const alreadyExists = !data || data.length === 0;
```

**Problems:**
1. ❌ Does NOT use `RETURNING id` pattern
2. ❌ Checks `data.length === 0` but Supabase `.select()` behavior is ambiguous
3. ❌ Not explicit about conflict resolution

**Required Pattern:**
```sql
INSERT INTO evaluation_artifacts (...)
VALUES (...)
ON CONFLICT (job_id, artifact_type) DO NOTHING
RETURNING id;
```

If `id` is null, artifact already existed (conflict).

---

## 5. Terminal State Update (Not Atomic Enough)

**Current Code** (`lib/jobs/phase2.ts` lines 215-235):
```typescript
const persistResult = await persistOutput(jobId, manuscriptId, result);

if (persistResult.alreadyExists) {
  await updateJob(jobId, { status: "complete", ... });
} else if (persistResult.persisted) {
  await updateJob(jobId, { status: "complete", ... });
}
```

**Issues:**
1. ❌ No check if job is still eligible (could be canceled between persist and update)
2. ❌ Two separate DB calls (not atomic)
3. ❌ If `updateJob` fails, artifact exists but job not marked complete

**Better Pattern:**
```typescript
// 1. Persist artifact (returns success/already_done)
const { inserted, already_exists } = await persistOutput(...);

// 2. Conditionally update job (only if still running + phase1 complete)
if (inserted || already_exists) {
  const updated = await updateJobConditional(jobId, {
    status: "complete",
    where: {
      status: "running",
      "progress.phase": "phase1",
      "progress.phase_status": "complete"
    }
  });
  
  if (!updated) {
    // Job changed state (canceled/failed) - rollback not needed, artifact is idempotent
    console.warn("Job no longer eligible for completion");
  }
}
```

---

## 6. Read Artifact Verification

**Endpoint:** `GET /api/jobs/:id/artifacts?type=one_page_summary`  
**File:** `app/api/jobs/[id]/artifacts/route.ts`  
**Status:** ✅ Implemented

---

## 7. Fixes Required

### Fix 1: Add `job_id` to `manuscript_chunks`

**Migration:** `supabase/migrations/20260124000001_add_job_id_to_chunks.sql`

```sql
-- Add job_id to manuscript_chunks for Phase-1 → Phase-2 linkage
ALTER TABLE public.manuscript_chunks
  ADD COLUMN job_id TEXT NULL;  -- Nullable for backward compat with existing chunks

-- Backfill strategy: leave existing chunks with NULL job_id
-- New Phase 1 runs will populate job_id

-- Add index for Phase 2 queries
CREATE INDEX idx_manuscript_chunks_job_id 
  ON public.manuscript_chunks(job_id);

COMMENT ON COLUMN public.manuscript_chunks.job_id IS 
  'Links chunk to the job that created it. NULL for legacy chunks. Phase 2 queries by job_id to avoid aggregating stale data.';
```

### Fix 2: Update Phase 1 to write `job_id`

**File:** `lib/manuscripts/chunks.ts`

Add `job_id` parameter to:
- `ensureChunks(manuscriptId, text, jobId)`
- `upsertChunks(manuscriptId, chunks, jobId)`

Write `job_id` when creating/updating chunks.

### Fix 3: Update Phase 2 to filter by `job_id`

**File:** `lib/jobs/phase2.ts`

Change:
```typescript
const chunks = await getManuscriptChunks(manuscriptId);
```

To:
```typescript
const chunks = await getChunksForJob(manuscriptId, jobId);
```

Where `getChunksForJob()` queries:
```sql
SELECT * FROM manuscript_chunks 
WHERE manuscript_id = $1 AND job_id = $2
```

### Fix 4: Fix artifact table `job_id` type

**Migration:** `supabase/migrations/20260124000002_fix_artifact_job_id_type.sql`

```sql
-- Change job_id from TEXT to UUID to match evaluation_jobs.id
ALTER TABLE public.evaluation_artifacts
  ALTER COLUMN job_id TYPE UUID USING job_id::uuid;
```

### Fix 5: Fix Phase 2 persistence to use explicit RETURNING

**File:** `lib/jobs/phase2.ts`

Replace upsert with raw SQL:
```typescript
const { data, error } = await supabase.rpc('insert_artifact_idempotent', {
  p_job_id: jobId,
  p_manuscript_id: manuscriptId,
  p_artifact_type: 'one_page_summary',
  p_content: result
});

// data.inserted = true if new row, false if conflict
```

Or use PostgREST upsert properly:
```typescript
const { data, error } = await supabase
  .from("evaluation_artifacts")
  .insert(artifact)
  .select('id')
  .single();

// If error.code === '23505' (unique violation), artifact already exists
const alreadyExists = error?.code === '23505';
```

---

## 8. Proof Commands (After Fixes Applied)

### Prerequisites
```bash
# Apply migrations
npx supabase db push

# Start dev server
npm run dev &
DEV_PID=$!

# Source environment
source .env.local
```

### Test Script
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== Phase 2 Vertical Slice Proof ==="

# 1. Create job
echo "[1] Creating job..."
JOB_JSON=$(curl -s -X POST http://localhost:3000/api/internal/jobs \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 1, "job_type": "full_evaluation"}')

JOB_ID=$(echo "$JOB_JSON" | jq -r '.job.id')
echo "Created job: $JOB_ID"

# 2. Start daemon
echo "[2] Starting daemon..."
npm run worker:daemon &
DAEMON_PID=$!
sleep 2

# 3. Wait for Phase 1 completion
echo "[3] Waiting for Phase 1 to complete..."
for i in {1..30}; do
  sleep 2
  ELIGIBLE=$(curl -s http://localhost:3000/api/internal/jobs \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    | jq '.summary.phase2_eligible')
  
  if [[ "$ELIGIBLE" -gt 0 ]]; then
    echo "✓ Phase 2 eligible count: $ELIGIBLE (after ${i}x2s)"
    break
  fi
  
  if [[ $i -eq 30 ]]; then
    echo "✗ Phase 1 did not complete in 60s"
    kill $DAEMON_PID 2>/dev/null || true
    exit 1
  fi
done

# 4. Wait for Phase 2 completion
echo "[4] Waiting for Phase 2 to complete..."
for i in {1..20}; do
  sleep 2
  STATUS=$(curl -s http://localhost:3000/api/jobs/$JOB_ID | jq -r '.job.status')
  
  if [[ "$STATUS" == "complete" ]]; then
    echo "✓ Job complete (after ${i}x2s)"
    break
  fi
  
  if [[ $i -eq 20 ]]; then
    echo "✗ Job did not complete in 40s"
    kill $DAEMON_PID 2>/dev/null || true
    exit 1
  fi
done

# 5. Verify artifact exists
echo "[5] Verifying artifact..."
ARTIFACT_JSON=$(curl -s "http://localhost:3000/api/jobs/$JOB_ID/artifacts?type=one_page_summary" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

ARTIFACT_OK=$(echo "$ARTIFACT_JSON" | jq -r '.ok')
if [[ "$ARTIFACT_OK" == "true" ]]; then
  echo "✓ Artifact found"
  echo "$ARTIFACT_JSON" | jq '.artifact.content.summary' | head -c 100
  echo "..."
else
  echo "✗ Artifact not found: $ARTIFACT_JSON"
  kill $DAEMON_PID 2>/dev/null || true
  exit 1
fi

# 6. Stop daemon
kill $DAEMON_PID 2>/dev/null || true
sleep 1

# 7. Re-run daemon (idempotency test)
echo "[6] Re-running daemon (idempotency test)..."
npm run worker:daemon &
DAEMON_PID2=$!
sleep 5
kill $DAEMON_PID2 2>/dev/null || true

# 8. Verify no duplicates
echo "[7] Checking artifact count..."
ARTIFACT_COUNT=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/evaluation_artifacts?job_id=eq.$JOB_ID&select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  | jq 'length')

if [[ "$ARTIFACT_COUNT" == "1" ]]; then
  echo "✓ Exactly 1 artifact (idempotency verified)"
else
  echo "✗ Expected 1 artifact, found: $ARTIFACT_COUNT"
  exit 1
fi

echo "=== ✓ ALL CHECKS PASSED ==="
```

---

## 9. Daemon Double-Initialization Fix

**File:** `scripts/worker-daemon.mjs`

**Issue:** Signal handlers registered multiple times or daemon logs "started" twice.

**Check:**
```bash
grep -n "process.on\|Worker daemon started" scripts/worker-daemon.mjs
```

**Fix:** Ensure signal handlers registered only once (outside any loops/retries).
