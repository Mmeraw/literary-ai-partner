# Phase 2 Vertical Slice Proof

**Status:** Ready for execution  
**Date:** 2026-01-25  
**Purpose:** Document and prove Phase 1 → Phase 2 data flow with idempotent artifact persistence

---

## 1. Phase 2 Eligibility Logic

### Predicate (Daemon Filter)

**File:** [app/api/internal/jobs/route.ts:47-51](../app/api/internal/jobs/route.ts#L47-L51)

```typescript
const phase2Candidates = allJobs.filter(j => 
  j.status === "running" &&
  j.progress?.phase === "phase_1" &&
  j.progress?.phase_status === "complete"
);
```

**Fields:**
- `status = "running"` (top-level job status)
- `progress.phase = "phase_1"` (canonical phase identifier)
- `progress.phase_status = "complete"` (intra-phase state)

### Phase 1 Completion Write

**File:** [lib/jobs/phase1.ts:372-389](../lib/jobs/phase1.ts#L372-L389)

When Phase 1 completes, it sets:

```typescript
final_phase_status = PHASE_1_STATES.COMPLETED; // = "complete"

await updateJob(jobId, {
  progress: {
    message,
    finished_at,
    phase: "phase_1",
    phase_status: final_phase_status,  // ✅ "complete"
    total_units: finalChunks.length,
    completed_units: finalDoneCount,
    phase1_last_processed_index: finalDoneCount > 0 ? finalDoneCount - 1 : -1,
    lease_id: null,  // ✅ Clears lease so Phase 2 can acquire
    lease_expires_at: null,
  },
  partial,
  last_progress_at: new Date().toISOString(),
});
```

**✅ Confirmed:** Phase 1 write and Phase 2 eligibility use identical value: `"complete"`

---

## 2. Phase 1 → Chunks → Phase 2 Linkage

### Chunks Table Schema

**Migration:** [supabase/migrations/20260124000001_add_job_id_to_chunks.sql](../supabase/migrations/20260124000001_add_job_id_to_chunks.sql)

```sql
ALTER TABLE manuscript_chunks 
  ADD COLUMN job_id UUID NULL;

CREATE INDEX idx_manuscript_chunks_manuscript_job 
  ON manuscript_chunks(manuscript_id, job_id);
```

**Type:** `UUID` (matches `evaluation_jobs.id`)  
**Nullability:** Nullable for backward compatibility with pre-migration chunks  
**Indexes:**
- `idx_manuscript_chunks_job_id` - Single column index (WHERE job_id IS NOT NULL)
- `idx_manuscript_chunks_manuscript_job` - Composite index for Phase 2 queries

### Phase 1 Writes job_id to Chunks

**File:** [lib/jobs/phase1.ts:105](../lib/jobs/phase1.ts#L105)

```typescript
const allChunks = await ensureChunks(manuscriptIdNum, jobId);
```

**Implementation:** [lib/manuscripts/chunks.ts:164-176](../lib/manuscripts/chunks.ts#L164-L176)

```typescript
export async function ensureChunks(
  manuscriptId: number,
  jobId: string  // ✅ Passed from Phase 1
): Promise<ChunkRow[]> {
  // ... creates or updates chunks with job_id ...
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .upsert(chunks.map(c => ({ ...c, job_id: jobId })), {
      onConflict: "manuscript_id,chunk_index",
      ignoreDuplicates: false,
    })
    .select();
}
```

### Phase 2 Reads Chunks by job_id

**File:** [lib/manuscripts/chunks.ts:87-103](../lib/manuscripts/chunks.ts#L87-L103)

```typescript
export async function getChunksForJob(
  manuscriptId: number,
  jobId: string
): Promise<ChunkRow[]> {
  const { data, error } = await supabase
    .from("manuscript_chunks")
    .select("*")
    .eq("manuscript_id", manuscriptId)  // ✅ Filter by manuscript
    .eq("job_id", jobId)                // ✅ Filter by job
    .order("chunk_index", { ascending: true });

  return (data as ChunkRow[]) || [];
}
```

**✅ Proven:** Phase 2 only aggregates chunks from the current job, not stale data from previous runs.

---

## 3. Artifacts Table: DB-Level Idempotency

### Schema Guarantee

**Migration:** [supabase/migrations/20260124200000_create_evaluation_artifacts_table.sql:25](../supabase/migrations/20260124200000_create_evaluation_artifacts_table.sql#L25)

```sql
CONSTRAINT unique_job_artifact UNIQUE(job_id, artifact_type)
```

**Enforces:** One artifact per (job_id, artifact_type) pair at DB level.

### Phase 2 Persistence Logic

**File:** [lib/jobs/phase2.ts:224-281](../lib/jobs/phase2.ts#L224-L281)

```typescript
async function persistOutput(
  jobId: string,
  manuscriptId: number,
  result: { summary: string; overallScore: number; chunkCount: number; processedCount: number; sourceHash: string },
): Promise<{ persisted: boolean; alreadyExists: boolean; artifactId?: string }> {
  // Code-level precheck (fast exit)
  const exists = await artifactExists(jobId);
  if (exists) {
    return { persisted: false, alreadyExists: true };
  }

  // DB-level idempotency via upsert + ignoreDuplicates
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .upsert(artifact, {
      onConflict: "job_id,artifact_type",
      ignoreDuplicates: true,  // ✅ Don't overwrite existing
    })
    .select("id")
    .maybeSingle();

  if (error) {
    const code = (error as any)?.code;
    if (code === "23505") {  // Unique constraint violation
      return { persisted: false, alreadyExists: true };
    }
    throw new Error(`Failed to persist: ${error.message}`);
  }

  if (data) {
    return { persisted: true, artifactId: data.id };
  } else {
    // INSERT returned no rows → conflict occurred
    return { persisted: false, alreadyExists: true };
  }
}
```

**Idempotency Guarantees:**
1. **First run:** INSERT succeeds → `{ persisted: true }`
2. **Rerun (same job_id):** UNIQUE constraint triggers → `{ alreadyExists: true }`
3. **No overwrite:** Existing artifacts are never modified

---

## 4. Terminal State Rules in Phase 2

**File:** [lib/jobs/phase2.ts:367-400](../lib/jobs/phase2.ts#L367-L400)

```typescript
const persistResult = await persistOutput(jobId, manuscriptId, result);

if (!persistResult.persisted && !persistResult.alreadyExists) {
  // Persistence failed - don't mark complete
  throw new Error("Failed to persist Phase 2 output");
}

// Mark job complete ONLY if:
// - persistResult.persisted === true (new artifact created), OR
// - persistResult.alreadyExists === true (idempotent rerun)
await updateJob(jobId, {
  status: "complete",
  progress: {
    message: persistResult.alreadyExists
      ? "Phase 2 complete (artifact already exists - idempotent)"
      : "Phase 2 complete - one-page summary generated",
    finished_at: new Date().toISOString(),
    phase: "phase_2",
    phase_status: "complete",
    total_units: result.chunkCount,
    completed_units: result.processedCount,
    lease_id: null,
    lease_expires_at: null,
  },
  partial: false,
  last_progress_at: new Date().toISOString(),
});
```

**Rules:**
- ✅ Job marked `complete` on first run (new artifact)
- ✅ Job marked `complete` on rerun (idempotent path)
- ✅ Job stays `running` if persistence throws
- ✅ Progress message distinguishes "new" vs "already exists"

---

## 5. Vertical Slice Script

**File:** [scripts/test-phase2-vertical-slice.sh](../scripts/test-phase2-vertical-slice.sh)

### Expected Flow

```bash
#!/usr/bin/env bash
# Phase 2 Vertical Slice Test
# Proves: Phase 1 → chunks → Phase 2 → artifacts (idempotent)

set -e

BASE_URL="http://localhost:3002"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

echo "=== Phase 2 Vertical Slice Test ==="

# Step 1: Create job
JOB_ID=$(curl -s -X POST "$BASE_URL/api/internal/jobs" \
  -H "x-service-role: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 1, "job_type": "evaluate_full"}' \
  | jq -r '.job.id')

echo "✅ Created job: $JOB_ID"

# Step 2: Start daemon (runs Phase 1 + Phase 2)
node scripts/worker-daemon.mjs &
DAEMON_PID=$!
echo "✅ Started daemon (PID: $DAEMON_PID)"

# Step 3: Wait for completion (poll job status)
for i in {1..60}; do
  STATUS=$(curl -s "$BASE_URL/api/jobs/$JOB_ID" | jq -r '.status')
  PHASE=$(curl -s "$BASE_URL/api/jobs/$JOB_ID" | jq -r '.progress.phase')
  
  if [ "$STATUS" = "complete" ] && [ "$PHASE" = "phase_2" ]; then
    echo "✅ Job complete (Phase 2 finished)"
    break
  fi
  
  echo "⏳ Waiting... status=$STATUS phase=$PHASE (${i}s)"
  sleep 1
done

# Step 4: Verify artifact exists
ARTIFACT_COUNT=$(psql "$DATABASE_URL" -t -c \
  "SELECT COUNT(*) FROM evaluation_artifacts WHERE job_id = '$JOB_ID'")

if [ "$ARTIFACT_COUNT" -eq 1 ]; then
  echo "✅ Artifact exists: 1 row for job_id=$JOB_ID"
else
  echo "❌ Expected 1 artifact, found $ARTIFACT_COUNT"
  exit 1
fi

# Step 5: Rerun Phase 2 (idempotency test)
curl -s -X POST "$BASE_URL/api/jobs/$JOB_ID/run-phase2"
sleep 2

# Step 6: Verify no duplicate artifacts
ARTIFACT_COUNT_AFTER=$(psql "$DATABASE_URL" -t -c \
  "SELECT COUNT(*) FROM evaluation_artifacts WHERE job_id = '$JOB_ID'")

if [ "$ARTIFACT_COUNT_AFTER" -eq 1 ]; then
  echo "✅ Idempotency proven: still 1 artifact (no duplicates)"
else
  echo "❌ Duplicate created! Found $ARTIFACT_COUNT_AFTER artifacts"
  exit 1
fi

# Cleanup
kill $DAEMON_PID 2>/dev/null || true

echo "=== ✅ Phase 2 Vertical Slice PASSED ==="
```

### Success Criteria

1. ✅ Job progresses: `queued` → `running` (Phase 1) → `running` (Phase 2) → `complete`
2. ✅ Exactly 1 artifact row exists after Phase 2
3. ✅ Rerunning Phase 2 does NOT create duplicate artifacts
4. ✅ Daemon processes job cleanly (no 404/409 spam)

---

## 6. String Alignment Verification

### No Mismatches Found ✅

**Phase 1 writes:** `phase_status = "complete"`  
**Phase 2 reads:** `progress.phase_status === "complete"`

**Canonical constant:** `PHASE_1_STATES.COMPLETED = "complete"`

All values aligned.

---

## 7. Legacy Field Cleanup ✅

**Removed:** All `progress.stage` writes from `phase1.ts` and `phase2.ts`

**Before:**
```typescript
progress: {
  stage: "complete",  // ❌ Legacy
  phase_status: "complete",  // ✅ Canonical
}
```

**After:**
```typescript
progress: {
  phase_status: "complete",  // ✅ Canonical only
}
```

**Canonical audit passes:** Exit code 0 (warnings only, non-blocking)

---

## Summary

| Component | Status | Location |
|-----------|--------|----------|
| Phase 2 eligibility predicate | ✅ Documented | [app/api/internal/jobs/route.ts:47-51](../app/api/internal/jobs/route.ts#L47-L51) |
| Phase 1 completion write | ✅ Documented | [lib/jobs/phase1.ts:372-389](../lib/jobs/phase1.ts#L372-L389) |
| Chunks table schema | ✅ Documented | [supabase/migrations/20260124000001_add_job_id_to_chunks.sql](../supabase/migrations/20260124000001_add_job_id_to_chunks.sql) |
| Phase 1 writes job_id | ✅ Proven | [lib/jobs/phase1.ts:105](../lib/jobs/phase1.ts#L105) |
| Phase 2 reads by job_id | ✅ Proven | [lib/manuscripts/chunks.ts:87-103](../lib/manuscripts/chunks.ts#L87-L103) |
| Artifacts DB idempotency | ✅ Proven | [supabase/migrations/20260124200000_create_evaluation_artifacts_table.sql:25](../supabase/migrations/20260124200000_create_evaluation_artifacts_table.sql#L25) |
| Phase 2 persistence logic | ✅ Implemented | [lib/jobs/phase2.ts:224-281](../lib/jobs/phase2.ts#L224-L281) |
| Terminal state rules | ✅ Implemented | [lib/jobs/phase2.ts:367-400](../lib/jobs/phase2.ts#L367-L400) |
| Legacy stage field | ✅ Removed | phase1.ts, phase2.ts |
| String alignment | ✅ Verified | "complete" everywhere |

**Phase 2 vertical slice is fully documented and ready for execution.**

Run: `bash scripts/test-phase2-vertical-slice.sh`
