# Phase 2D Quick Reference

**Phase 2D = Concurrency + Correctness Hardening**

## The 7 Invariants (Must All Be Green)

| # | Invariant | Current | Test Needed |
|---|-----------|---------|-------------|
| 1 | Atomic Claim (no duplicates) | ✅ RPC `FOR UPDATE SKIP LOCKED` | Multi-worker concurrent test |
| 2 | Lease Expiry & Reclaim | ✅ `lease_until` + check | Timeout + reclaim test |
| 3 | No Partial Writes | ✅ Conditional updates | Crash mid-transaction test |
| 4 | Idempotency (exactly-once effects) | ⬜ Need unique constraints | Retry-duplicate test |
| 5 | Deterministic State Machine | ✅ Status guards in WHERE | Transition table test |
| 6 | Reconciliation (sweeper loop) | ⬜ Pattern defined | Stale lease detection test |
| 7 | Observable & Auditable | ⬜ Reason codes + logs | Audit trail capture in CI |

## What's Already Built (Phase 2C Foundation)

```typescript
// From workers/claimJob.ts
claimNextJob(workerId)      // ✅ Atomic claim via RPC
updateHeartbeat(jobId, id)  // ✅ Renews lease_until
releaseJob(jobId)           // ✅ Releases on crash
completeJob(jobId, result)  // ✅ Atomic finalize
failJob(jobId, error)       // ✅ Atomic fail
```

## What Needs Phase 2D

### 1. Idempotency Keys (On Chunk Results)
```sql
-- Add to schema:
ALTER TABLE chunk_results 
  ADD CONSTRAINT unique_chunk_attempt UNIQUE (job_id, chunk_id, attempt);

-- Use in writes:
INSERT INTO chunk_results (...) VALUES (...)
  ON CONFLICT (job_id, chunk_id, attempt) 
  DO NOTHING;  -- Idempotent: duplicate writes are no-ops
```

### 2. Reconciler Sweeper (Background Loop)
```typescript
// New: ReconcilerLoop
async function reconcileStaleLeases() {
  const staleJobs = await supabase
    .from('evaluation_jobs')
    .select('id, worker_id, lease_until')
    .eq('status', 'running')
    .lt('lease_until', new Date().toISOString());

  for (const job of staleJobs) {
    await supabase
      .from('evaluation_jobs')
      .update({ status: 'queued', lease_until: null, reason: 'lease_expired' })
      .eq('id', job.id)
      .eq('status', 'running');
    
    console.log(`[RECONCILE] Job ${job.id} reclaimed (was ${job.worker_id})`);
  }
}

// Run every 30 seconds
setInterval(reconcileStaleLeases, 30_000);
```

### 3. Failure-Simulation Tests (7 Tests)
```typescript
// Test 1: Concurrent Claim
async function testConcurrentClaim() {
  const jobs = [job1, job2, ..., job5];
  const workers = [w1, w2, ..., w10];
  
  const claims = await Promise.all(
    workers.map(w => claimNextJob(w.id))
  );
  
  // Assert: exactly 5 non-null (5 jobs claimed once each)
  const claimed = claims.filter(c => c !== null).length;
  expect(claimed).toBe(5);
}

// Test 2: Lease Timeout & Reclaim
async function testLeaseExpiry() {
  const job = await claimNextJob('worker-1');
  // Fastforward time beyond lease
  jest.advanceTimersByTime(LEASE_TIMEOUT + 1000);
  
  const reclaimed = await claimNextJob('worker-2');
  expect(reclaimed?.id).toBe(job.id); // Same job, different worker
}

// Test 3–7: Similar patterns for crash, idempotency, reconcile, etc.
```

### 4. Observable Reason Codes
```typescript
// Add to all state changes:
const REASONS = {
  CLAIM: 'job_claimed',
  START: 'job_started',
  HEARTBEAT: 'lease_renewed',
  COMPLETE: 'job_completed',
  FAIL: 'job_failed',
  RECLAIM: 'lease_expired_reclaimed',
  RECONCILE: 'stale_lease_fixed',
};

// Log every transition:
console.log(`[${REASONS.CLAIM}] job=${jobId}, worker=${workerId}, time=${now}`);
```

## CI Evidence Gate (To Implement)

```yaml
# .github/workflows/phase2d-evidence.yml
name: Phase 2D Concurrency Gate

on:
  push:
    branches: [ main ]
    paths:
      - 'workers/**'
      - 'phase2d*.test.ts'  # New tests

jobs:
  concurrency:
    runs-on: ubuntu-latest
    steps:
      - name: Run Phase 2D Concurrency Tests
        run: npm run test:phase2d
      
      - name: Verify Invariants
        run: |
          # Parse test output for all 7 invariants ✅
          # Log reason codes
          # Capture audit trail
      
      - name: Archive Evidence
        run: |
          echo "✅ PHASE 2D LOCKED" >> phase2d-evidence.log
          # Upload as artifact
```

## Timeline

**Realistic**: 2–3 days full-time per developer

- **Day 1**: Implement idempotency + reconciler + reason codes
- **Day 2**: Write 7 invariant tests (concurrency, crash, retry, etc.)
- **Day 3**: Integrate CI gate + prove on main

**Ready to start**: When Phase 2C is locked (already ✅ as of 2026-01-28)

---

**Next**: Begin Phase 2D implementation sprint or hand off to team.

