# Phase A Week 1: Idempotent Retries — Status Report

**Date:** 2026-01-30  
**Status:** 🔍 Audit Complete — Foundation Already Strong

---

## What's Already Implemented ✅

### Phase 1 (Chunking + Embedding)

**File:** [`lib/jobs/phase1.ts`](../lib/jobs/phase1.ts)

1. **Lease-based concurrency control** (lines 83-90)
   ```typescript
   const lease_id = crypto.randomUUID();
   const leasedJob = await acquireLeaseForPhase1(jobId, lease_id, 30);
   ```
   - Atomic lease acquisition via RPC
   - 30-second TTL
   - Other workers blocked while lease is active

2. **Chunk-level claim atomicity** (lines 211-217)
   ```typescript
   const claimed = await claimChunkForProcessing(chunk.id, 3);
   if (!claimed) {
     console.log(`Chunk already claimed or done, skipping`);
     continue;
   }
   ```
   - Prevents duplicate processing
   - Respects `maxAttempts` (default 3)

3. **Crash recovery** (line 128)
   ```typescript
   const eligibleChunks = await getEligibleChunksWithStuckRecovery(manuscriptIdNum, 3);
   ```
   - Finds chunks with expired leases
   - Resets to `'pending'` for retry

4. **Idempotent resume** (lines 131-137)
   - Skips chunks with `status = 'done'`
   - Counts existing completed chunks
   - Continues from last processed index

**Verdict:** Phase 1 retry logic is **production-ready**.

---

### Phase 2 (Evaluation Calls)

**File:** [`workers/phase2Worker.ts`](../workers/phase2Worker.ts)

1. **Job claim RPC** (line 122)
   ```typescript
   const job = await claimNextJob(WORKER_ID, 300); // 5min lease
   ```
   - Atomic claim via `claim_job_atomic` RPC
   - Status transition: `'queued'` → `'running'`
   - Lease expires after 5 minutes

2. **Lease renewal** (lines 160-175)
   ```typescript
   heartbeatTimer = setInterval(async () => {
     const renewed = await renewLease(currentJobId, WORKER_ID);
     if (!renewed) log('warn', 'Failed to renew lease');
   }, 60000); // 1 minute
   ```
   - Auto-renews every 60 seconds
   - Keeps long-running jobs alive

3. **Provider call idempotency** (via schema)
   - Table: `evaluation_provider_calls`
   - Unique constraint: `(job_id, provider, phase)`
   - Prevents duplicate external API calls

**Verdict:** Phase 2 has **lease management**, but needs **error handling** and **bounded retries**.

---

## What Needs to Be Added 🚧

### 1. Structured Error Handling (Phase 2)

**Current gap:** Errors are logged but not persisted to `evaluation_jobs.last_error`.

**Required changes:**
- Catch all exceptions in `processJob()` (line 197)
- Write structured error to `last_error` JSONB column
- Transition job status to `'failed'`

**File to modify:** [`workers/phase2Worker.ts`](../workers/phase2Worker.ts)

**Estimated effort:** 2-3 hours

---

### 2. Retry Classification (Phase 2)

**Current gap:** All errors treated the same—no retryability logic.

**Required changes:**
- Error envelope schema with `retryable` flag
- Map provider errors to standard codes:
  - OpenAI 429 → `{ code: 'RATE_LIMIT', retryable: true }`
  - Network timeout → `{ code: 'TIMEOUT', retryable: true }`
  - Invalid input → `{ code: 'INVALID_INPUT', retryable: false }`

**File to modify:** [`workers/phase2Evaluation.ts`](../workers/phase2Evaluation.ts)

**Estimated effort:** 3-4 hours

---

### 3. Bounded Retry Policy (Phase 2)

**Current gap:** Jobs don't auto-retry after transient failures.

**Required changes:**
- Add columns to `evaluation_jobs`:
  ```sql
  ALTER TABLE evaluation_jobs 
    ADD COLUMN attempt_count INTEGER DEFAULT 0,
    ADD COLUMN max_attempts INTEGER DEFAULT 3;
  ```
- Worker checks `attempt_count < max_attempts` before retrying
- Implement exponential backoff (30s, 90s, 270s)
- Mark job `'failed'` after max attempts exhausted

**Files to modify:**
- Migration: `supabase/migrations/20260130000001_add_retry_tracking.sql`
- Worker logic: [`workers/phase2Worker.ts`](../workers/phase2Worker.ts)

**Estimated effort:** 4-5 hours

---

### 4. Dead-Letter Queue UI (Admin)

**Current gap:** No way to view failed jobs in dashboard.

**Required changes:**
- Admin page: `/admin/failed-jobs`
- Query: `SELECT * FROM evaluation_jobs WHERE status = 'failed' ORDER BY updated_at DESC`
- Display: job ID, error code, timestamp, retry button

**Files to create:**
- `app/admin/failed-jobs/page.tsx`
- `lib/admin/failedJobs.ts` (API wrapper)

**Estimated effort:** 6-8 hours

---

## Testing Strategy

### Unit Tests (Add to existing suite)

1. **Retry logic with mocked failures**
   ```typescript
   test('OpenAI rate limit triggers retry', async () => {
     mockOpenAI.mockRejectedValueOnce({ status: 429 });
     const result = await processJob(testJob);
     expect(result.retryable).toBe(true);
   });
   ```

2. **Lease expiry simulation**
   ```typescript
   test('Expired lease allows other workers to claim', async () => {
     const job1 = await claimNextJob('worker-1', 1); // 1sec lease
     await sleep(2000);
     const job2 = await claimNextJob('worker-2', 60);
     expect(job1.id).toBe(job2.id); // Same job reclaimed
   });
   ```

### Integration Tests

1. **Simulate worker crash mid-job**
   - Start job with worker-1
   - Kill worker-1 before completion
   - Verify worker-2 picks up after lease expiry

2. **Simulate OpenAI rate limit**
   - Mock OpenAI to return 429
   - Verify job retries with backoff
   - Verify success on 3rd attempt

### Load Tests

- 100 concurrent jobs with 10% failure rate
- Verify no jobs hang or disappear
- Verify retry queue doesn't overflow

---

## Week 1 Plan

**Days 1-2:** Structured error handling + error envelopes  
**Days 3-4:** Bounded retry policy + migration  
**Day 5:** Testing + integration verification  

**Deliverable:** Phase 2 can retry transient failures without duplicate work.

---

## Success Criteria

✅ Worker crash mid-job → another worker picks up within 60s  
✅ OpenAI rate limit → retry succeeds after backoff  
✅ Invalid input → job fails immediately (non-retryable)  
✅ 3x transient errors → job marked `'failed'` after max attempts  
✅ All errors persisted to `last_error` with structured envelope  

---

## Next Steps (Week 2)

- Admin UI for failed jobs
- Observability dashboards (job success rate, top errors)
- Documentation for error codes

---

## References

- [Phase A Roadmap](./PHASE_A_JOB_RELIABILITY.md)
- [Job Contract](./JOB_CONTRACT_v1.md)
- [Lease Specification](./evaluation_jobs_lease_spec.md)
