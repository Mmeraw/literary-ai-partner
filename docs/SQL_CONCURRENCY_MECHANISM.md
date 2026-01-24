# SQL Concurrency Mechanism - Optimistic Locking

**Status**: ✅ Proven via concurrent worker test (2026-01-24)

---

## The Atomic Guard

All job lease acquisitions use this pattern:

```typescript
const { data, error } = await supabase
  .from("evaluation_jobs")
  .update({
    progress: mergedProgress,
    status: "running",
    updated_at: new Date().toISOString(),
  })
  .eq("id", id)
  .eq("status", "queued")
  .eq("updated_at", existing.updated_at)  // ← CRITICAL: Optimistic lock
  .select("id, manuscript_id, job_type, status, progress, created_at, updated_at")
  .maybeSingle();
```

**Key**: `.eq("updated_at", existing.updated_at)`

---

## How It Works

### Scenario: 3 Workers Racing for 1 Job

**Initial State** (Job A):
```
id: "abc-123"
status: "queued"
updated_at: "2026-01-24T10:00:00.000Z"
```

### Step 1: All Workers Read Job

Worker-1, Worker-2, Worker-3 all call `getJob("abc-123")` and see:
```
status: "queued"
updated_at: "2026-01-24T10:00:00.000Z"
```

### Step 2: All Workers Attempt Update

**Worker-1** issues UPDATE:
```sql
UPDATE evaluation_jobs 
SET status = 'running', updated_at = '2026-01-24T10:00:00.123Z'
WHERE id = 'abc-123' 
  AND status = 'queued'
  AND updated_at = '2026-01-24T10:00:00.000Z';  -- Matches!
```
**Result**: ✅ 1 row updated (Worker-1 wins)

**Worker-2** issues UPDATE (microseconds later):
```sql
UPDATE evaluation_jobs 
SET status = 'running', updated_at = '2026-01-24T10:00:00.127Z'
WHERE id = 'abc-123' 
  AND status = 'queued'
  AND updated_at = '2026-01-24T10:00:00.000Z';  -- No longer matches!
```
**Result**: ❌ 0 rows updated (Worker-2 loses)

**Worker-3** issues UPDATE (microseconds later):
```sql
UPDATE evaluation_jobs 
SET status = 'running', updated_at = '2026-01-24T10:00:00.131Z'
WHERE id = 'abc-123' 
  AND status = 'queued'  -- Status already 'running'!
  AND updated_at = '2026-01-24T10:00:00.000Z';  -- No longer matches!
```
**Result**: ❌ 0 rows updated (Worker-3 loses)

---

## Why This Guarantees Exclusivity

1. **Postgres Row Lock**: First UPDATE acquires exclusive row lock
2. **Atomic Compare-and-Swap**: `updated_at` acts as version number
3. **Zero Rows Returned**: Losing workers get `data === null`
4. **No Silent Overwrites**: Impossible to accidentally re-assign lease

### Code Response
```typescript
if (!data) return null;  // Lost the race
return mapDbRowToJob(data);  // Won the race
```

Worker checks result:
```typescript
const leasedJob = await acquireLeaseForPhase1(jobId, lease_id, 30);

if (!leasedJob) {
  console.log("Phase1LeaseNotAcquired - another worker got it");
  return;  // Exit cleanly
}

// Only one worker reaches here
console.log("Lease acquired successfully");
```

---

## Test Evidence

**File**: `scripts/test-worker-lease.mjs`

**Output** (2026-01-24):
```
worker-3: Attempting to acquire lease 47d6da8e... for job b270f010...
worker-1: Attempting to acquire lease 82c75486... for job b270f010...
worker-2: Attempting to acquire lease c48a09ca... for job b270f010...
worker-3: ✅ LEASE ACQUIRED - lease_id=47d6da8e...
worker-1: ❌ Failed to acquire lease (lost race)
worker-2: ❌ Job not queued (status=running)
```

**Interpretation**:
- Worker-3 won the optimistic lock
- Worker-1 lost (updated_at mismatch)
- Worker-2 saw status already changed to "running"

---

## Alternative Approaches (Why We Don't Use Them)

### ❌ Advisory Locks
```sql
SELECT pg_advisory_lock(123);
```
**Problem**: Requires connection state management, can leak on crash

### ❌ SELECT FOR UPDATE
```sql
SELECT * FROM evaluation_jobs WHERE id = ? FOR UPDATE;
UPDATE ...;
```
**Problem**: Requires transaction management, more complex error handling

### ✅ Optimistic Locking (Our Choice)
```sql
UPDATE ... WHERE id = ? AND updated_at = ?;
```
**Benefits**:
- No transaction state
- Works with connection pooling
- Simple error handling (null = lost)
- Self-healing (no stuck locks)

---

## Chunk-Level Atomicity (Same Pattern)

Chunks use the same mechanism via RPC:

```sql
-- supabase/migrations/20260123222958_update_claim_chunk_function_with_lease.sql
CREATE OR REPLACE FUNCTION public.claim_chunk_for_processing(
  p_chunk_id uuid,
  p_worker_id uuid,
  p_lease_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated integer;
BEGIN
  UPDATE public.manuscript_chunks
  SET
    status = 'processing',
    lease_id = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    processing_started_at = now(),
    attempt_count = attempt_count + 1
  WHERE
    id = p_chunk_id
    AND status != 'done'  -- Terminal state guard
    AND (
      status = 'pending'
      OR (status = 'failed' AND attempt_count < max_attempts)
      OR (status = 'processing' AND lease_expires_at <= now())
    );
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated = 1;
END;
$$;
```

**Why this works**:
- Single atomic UPDATE
- Returns boolean (true = claimed, false = already taken)
- Multiple WHERE conditions act as business-level optimistic lock

---

## Contract Guarantee

From `docs/JOBS_STABILITY_CONTRACT.md`:

> **9. Concurrency Guarantees**
> 
> The system guarantees:
> - No double-processing of chunks
> - Exclusive job lease acquisition (proven 2026-01-24)
> - Atomic state transitions via optimistic locking

This guarantee is enforced by:
1. SQL-level atomicity (row locks + version check)
2. Application-level null checks
3. Proven via concurrent worker test

---

## Performance Characteristics

**Contention**: Low
- Most jobs have 1 worker attempt
- Concurrent attempts are rare (manual testing or heavy load)

**Failure Mode**: Graceful
- Losing workers exit cleanly
- No retries (job is already claimed)
- No stuck state (winner processes immediately)

**Scalability**: Excellent
- No cross-worker coordination needed
- Works with unlimited workers
- Connection pooling friendly

---

## Summary

**Question**: How do you prevent two workers from processing the same job?

**Answer**: Postgres atomic UPDATE with optimistic lock on `updated_at`.

**Proof**: Run `bash scripts/test-lease-concurrency.sh` and observe exactly one success.

**Contract**: Documented in `JOBS_STABILITY_CONTRACT.md` §9.

**Status**: 🔒 Proven and locked.
