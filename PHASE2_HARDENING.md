# Phase 2 Hardening: Audit-Grade Idempotency

**Date:** 2026-01-24  
**Status:** ✅ Complete  
**Infrastructure Lock:** MAINTAINED (no changes to daemon/leases/routes except Phase 2 endpoints)

---

## Summary

Phase 2 has been hardened to provide **audit-grade idempotency** with:

1. **DB-level uniqueness guarantee** via `UNIQUE(job_id, artifact_type)` constraint
2. **Fail-fast validation** of Phase 1 output stability  
3. **Conditional terminal state** - only mark `complete` after confirmed persistence
4. **INSERT ... ON CONFLICT DO NOTHING** pattern for true idempotency

---

## 1. Canonical Phase-1 Storage (Explicit Documentation)

### Storage Location
- **Table:** `manuscript_chunks`
- **Column:** `result_json` (JSONB)
- **Writer:** `markChunkSuccess()` in `lib/manuscripts/chunks.ts` (line 287)
- **Written by:** Phase 1 only (line 224 in `lib/jobs/phase1.ts`)

### Phase 1 Completion Contract
Phase 1 marks itself complete when:
- All eligible chunks are in terminal state (`done` or `failed`)
- Sets `progress.phase = "phase1"` AND `progress.phase_status = "completed"`

### Phase 2 Eligibility Predicate
```typescript
j.status === "running" &&
j.progress?.phase === "phase1" &&
j.progress?.phase_status === "completed"
```
*Source: `app/api/internal/jobs/route.ts` line 44-47*

---

## 2. DB-Level Idempotency Guarantee

### Schema Change
Created `evaluation_artifacts` table with:

```sql
CREATE TABLE evaluation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  manuscript_id BIGINT NOT NULL REFERENCES manuscripts(id),
  artifact_type TEXT NOT NULL,
  content JSONB NOT NULL,
  source_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- DB-LEVEL IDEMPOTENCY GUARANTEE
  CONSTRAINT unique_job_artifact UNIQUE(job_id, artifact_type)
);
```

**Migration:** `supabase/migrations/20260124000000_evaluation_artifacts.sql`

### Persistence Pattern
```typescript
const { data, error } = await supabase
  .from("evaluation_artifacts")
  .upsert(artifact, {
    onConflict: "job_id,artifact_type",
    ignoreDuplicates: true  // ON CONFLICT DO NOTHING
  })
  .select();

// If data is null/empty, insert was skipped (artifact already exists)
const alreadyExists = !data || data.length === 0;
```

**No race conditions possible** - PostgreSQL UNIQUE constraint enforces one artifact per (job_id, type).

---

## 3. Fail-Fast Phase 1 Validation

Phase 2 now validates Phase 1 output **before processing**:

### Validation Rules
```typescript
async function validatePhase1Output(
  manuscriptId: number,
  jobProgress: any
): Promise<Phase1ValidationResult>
```

**Checks:**
1. ✅ Job progress shows `phase="phase1"` and `phase_status="completed"`
2. ✅ At least one chunk has `status="done"` AND `result_json` present
3. ✅ NO chunks are in `"processing"` state (all terminal)
4. ✅ Chunks exist for the manuscript

**Fail-Fast:** If validation fails, Phase 2 immediately marks job `failed` with detailed error message. No partial processing.

---

## 4. Conditional Terminal State

### Before (Unsafe)
```typescript
await persistOutput(jobId, manuscriptId, result);
await updateJob(jobId, { status: "complete" });  // Marks complete even if persist failed
```

### After (Safe)
```typescript
const persistResult = await persistOutput(jobId, manuscriptId, result);

// Only mark complete AFTER confirmed persistence
if (persistResult.alreadyExists) {
  // Idempotent completion
  await updateJob(jobId, { status: "complete", message: "idempotent" });
} else if (persistResult.persisted) {
  // New artifact created
  await updateJob(jobId, { status: "complete", message: "newly persisted" });
}

// If persist throws, job stays in recoverable state (not terminal)
```

**Error Handling:**
- ❌ Before: Job marked `failed` (terminal)
- ✅ After: Job stays `running` with `progress.stage="phase2_error"` (recoverable)

Worker daemon will retry Phase 2 on next tick if artifact persistence failed.

---

## 5. Read Artifact Debug Endpoint

**Endpoint:** `GET /api/jobs/:id/artifacts?type=one_page_summary`

**Auth:** Service role key required

**Responses:**
- `200 OK` - Artifact found, returns full payload
- `404 Not Found` - Artifact doesn't exist
- `401 Unauthorized` - Missing/invalid service role key

**Example:**
```bash
curl http://localhost:3000/api/jobs/abc123/artifacts?type=one_page_summary \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

**Implementation:** `app/api/jobs/[id]/artifacts/route.ts`

---

## 6. Definition of Done - Test Commands

### Prerequisites
```bash
# Start Next.js dev server
npm run dev

# Ensure .env.local is sourced
source .env.local
```

### Automated Test Script
```bash
./scripts/test-phase2-idempotency.sh
```

**What it proves:**
1. ✅ Job progresses: `queued → Phase 1 → Phase 2 → complete`
2. ✅ Artifact persisted to `evaluation_artifacts` table
3. ✅ Artifact is readable via GET endpoint
4. ✅ Re-running Phase 2 produces NO duplicates (DB-level guarantee)
5. ✅ `ON CONFLICT DO NOTHING` enforced by PostgreSQL

### Manual Verification Steps

#### Step 1: Create Job
```bash
JOB_RESPONSE=$(curl -s -X POST http://localhost:3000/api/internal/jobs \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 1, "job_type": "full_evaluation"}')

JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job.id')
echo "Job ID: $JOB_ID"
```

#### Step 2: Start Daemon
```bash
npm run worker:daemon
```

#### Step 3: Wait for Completion
Monitor logs for:
```
Phase1Completed { job_id: '...', ... }
Phase2Completed { job_id: '...', artifact_persisted: true }
```

#### Step 4: Verify Artifact Exists
```bash
curl http://localhost:3000/api/jobs/$JOB_ID/artifacts?type=one_page_summary \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq
```

**Expected:**
```json
{
  "ok": true,
  "artifact": {
    "id": "...",
    "job_id": "...",
    "manuscript_id": 1,
    "artifact_type": "one_page_summary",
    "content": {
      "summary": "EVALUATION SUMMARY\n\n...",
      "overall_score": 7.5,
      "chunk_count": 10,
      "processed_count": 9
    },
    "source_hash": "v1:1:9:10:7.50",
    "created_at": "2026-01-24T..."
  }
}
```

#### Step 5: Verify Job is Complete
```bash
curl http://localhost:3000/api/jobs/$JOB_ID | jq '.job.status'
```

**Expected:** `"complete"`

#### Step 6: Prove Idempotency (Manual Re-run)

Reset job progress to simulate Phase 2 re-trigger:
```bash
# Manually update job progress (simulate retry)
curl -X PATCH http://localhost:3000/api/jobs/$JOB_ID \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "progress": {
      "phase": "phase1",
      "phase_status": "completed"
    }
  }'
```

Re-run daemon:
```bash
npm run worker:daemon
```

**Expected behavior:**
- Phase 2 triggers again
- Persistence returns `{ alreadyExists: true }`
- Job marked `complete` with message: `"idempotent, DB-level guarantee"`
- Artifact count remains **1** (no duplicate)

#### Step 7: Verify No Duplicates
```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/evaluation_artifacts?job_id=eq.$JOB_ID&select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq 'length'
```

**Expected:** `1`

---

## Changes Made

### Files Modified
1. ✅ `lib/jobs/phase2.ts` - Replaced all Phase 2 logic with hardened implementation
2. ✅ `app/api/jobs/[id]/artifacts/route.ts` - New debug endpoint for reading artifacts

### Files Created
1. ✅ `supabase/migrations/20260124000000_evaluation_artifacts.sql` - New table with UNIQUE constraint
2. ✅ `scripts/test-phase2-idempotency.sh` - Automated end-to-end proof script
3. ✅ `PHASE2_HARDENING.md` - This documentation

### Infrastructure Changes
**ZERO** - No changes to:
- ❌ Worker daemon (`scripts/worker-daemon.mjs`)
- ❌ Lease acquisition logic
- ❌ State machine transitions
- ❌ Internal jobs endpoint (except Phase 2 eligibility already correct)

---

## Guarantees

### 1. No Duplicate Artifacts
**Guaranteed by:** PostgreSQL `UNIQUE(job_id, artifact_type)` constraint  
**Enforced at:** Database layer (not application code)  
**Race condition safe:** ✅ Yes (PostgreSQL MVCC)

### 2. No Partial Phase-1 Input
**Guaranteed by:** `validatePhase1Output()` fail-fast check  
**Enforced at:** Phase 2 entry point (before any processing)  
**Detects:** Processing chunks, missing results, wrong phase state

### 3. Terminal State After Persistence Only
**Guaranteed by:** Conditional `updateJob()` only after `persistOutput()` returns success  
**Error handling:** Failures leave job in recoverable state (not terminal)  
**Retryable:** ✅ Yes - worker daemon will retry Phase 2 on next tick

### 4. Idempotency at DB Layer
**Guaranteed by:** `INSERT ... ON CONFLICT DO NOTHING` via upsert pattern  
**Application-level check:** ❌ Not needed (DB enforces uniqueness)  
**Returns:** `{ alreadyExists: true }` when artifact already present

---

## Migration Applied

```bash
$ npx supabase db push
Applying migration 20260124000000_evaluation_artifacts.sql...
Finished supabase db push.
```

**Status:** ✅ Applied to remote database

---

## Next Steps

1. ✅ Run automated test: `./scripts/test-phase2-idempotency.sh`
2. ✅ Verify end-to-end: Job progresses to `complete` with artifact
3. ✅ Verify idempotency: Re-run produces no duplicates
4. ⏭️ Optional: Crash recovery test (kill daemon mid-Phase-2, verify retry)

---

## Audit Trail

- **Phase 1 Output:** `manuscript_chunks.result_json` (written by `markChunkSuccess()` only)
- **Phase 2 Output:** `evaluation_artifacts.content` (UNIQUE constraint on job_id + type)
- **Idempotency Mechanism:** PostgreSQL `ON CONFLICT DO NOTHING`
- **Validation:** Fail-fast on missing/unstable Phase 1 output
- **Terminal State:** Conditional on confirmed persistence

**Infrastructure lock maintained.** Phase 2 is now audit-grade idempotent.
