# Phase 2D: Concurrency + Correctness Hardening for Job System

**Status**: Definition + Invariants Checklist  
**Target**: Make worker/job system safe for scale (100K+ concurrent jobs)

---

## Phase 2D Definition

**Scope**: Eliminate race conditions, double-processing, partial writes, and ghost jobs under concurrent workers, retries, crashes, and restarts.

**The 5 W's + How**:

| Dimension | Answer |
|-----------|--------|
| **Who** | API (queues jobs), Workers (claim/execute/release), Supabase (atomic locks via `FOR UPDATE SKIP LOCKED`), CI (proves invariants via tests) |
| **What** | Atomic claim, lease + heartbeat renewal, idempotency guards (unique constraints + conditional updates), retry rules, reconciliation of stuck leases |
| **When** | Job transitions: `queued` → `running` (claim), `running` → `complete`/`failed` (finalize), plus retry loops and lease reclaim on timeout/crash |
| **Where** | DB: `evaluation_jobs` table with `status`, `worker_id`, `lease_until`, `retry_count`, `last_error` fields; Worker runtime: heartbeat loop + error handlers; CI: failure-simulation tests (kill, duplicate claim, stale lease) |
| **Why** | Eliminate last class of non-local bugs: races (two workers claim same job), duplicates (retry writes same effect twice), partial writes (crash mid-transaction), ghost jobs (lease expires, nobody reclaims) |
| **How** | Atomic RPC: `claim_job_atomic(worker_id, now, lease_until)` with `FOR UPDATE SKIP LOCKED`; heartbeat loop to renew `lease_until`; strict state machine; idempotency keys per work unit; reconciler sweeps for stuck leases |

---

## Current State (As Of 2026-01-28)

### What Exists (Phase 2C-proven):
✅ Atomic claim via RPC (`claim_job_atomic`)  
✅ Lease-based recovery (worker_id + lease_until)  
✅ Heartbeat renewal (`updateHeartbeat`)  
✅ Release on crash (`releaseJob`)  
✅ Type safety (TypeScript + schema constraints)

### What Needs Phase 2D Proof:
⬜ Concurrency test: two workers claim same job (one must succeed, one must get null)  
⬜ Retry idempotency: same effect applied twice must be indistinguishable (once)  
⬜ Lease expiry: worker heartbeat expires → job becomes reclaimable  
⬜ Reconciler: detect stuck leases and auto-reclaim  
⬜ Crash simulation: worker dies mid-phase → job recovers correctly  
⬜ Double-claim prevention: duplicate workers hitting same job → deterministic winner  

---

## Phase 2D Invariants (Must-Haves)

### Invariant 1: Atomic Claim
**State**: For any job ID at any instant, at most one worker holds a valid lease.

**Test**: Two workers race to claim same job; exactly one gets a non-null result.
```typescript
// Pseudo-test
const worker1 = claimNextJob('worker-1');
const worker2 = claimNextJob('worker-2');  // concurrent
// Assert: (worker1 !== null && worker2 === null) || (worker1 === null && worker2 !== null)
```

**Proof**: `claim_job_atomic` uses `FOR UPDATE SKIP LOCKED`, ensuring serialized access.

---

### Invariant 2: Lease-Based Timeout & Reclaim
**State**: If a worker's heartbeat expires (lease_until < now), the job is eligible for reclaim by any other worker.

**Test**: 
1. Worker-1 claims job, starts work
2. Wait > lease_until (5 min in prod, 1 sec in test)
3. Worker-2 claims same job → succeeds (reclaims from timed-out worker-1)

**Proof**: RPC checks `lease_until IS NULL OR lease_until < p_now` in the WHERE clause.

---

### Invariant 3: No Partial Writes
**State**: All externally visible effects of a job are atomic or idempotent. If a worker crashes mid-phase, no half-written state leaks.

**Test**: 
1. Worker claims job → updates status to 'running'
2. Crash mid-write to evaluation_result
3. Next worker reclaims job → state is consistent (no half-written result field)

**Proof**: All updates use conditional checks (e.g., `WHERE status = 'running'`), and critical fields are updated together.

---

### Invariant 4: Exactly-Once Effects (Via Idempotency)
**State**: If a job is processed twice (e.g., retry after crash), all permanent effects (evaluation result, chunk completion) happen exactly once or are idempotent.

**Test**: 
1. Worker evaluates chunk → writes result with `(job_id, chunk_id, attempt)` unique constraint
2. Crash + retry: same worker or different worker re-evaluates same chunk
3. Result insertion fails (constraint violation) or upserts identically

**Proof**: Implement `(job_id, chunk_id, attempt) UNIQUE` constraint; use `INSERT ON CONFLICT DO NOTHING` or similar.

---

### Invariant 5: Deterministic State Transitions
**State**: Job status transitions are strictly ordered: `queued` → `running` → `complete`/`failed`. No backward transitions. No illegal jumps.

**Test**: 
1. Generate random sequence of transitions
2. Verify only legal transitions succeed (e.g., `queued` → `running` always works; `complete` → `running` always fails)

**Proof**: All UPDATE statements use `WHERE status = <expected>` guard; illegal transitions fail silently (no error thrown, but 0 rows affected).

---

### Invariant 6: Reconciliation (Sweeper Loop)
**State**: Any job with `lease_until < now` and `status = 'running'` is detected and marked as reclaimable or reconciled within X seconds.

**Test**: 
1. Create job with stale lease
2. Run reconciler
3. Job is moved to `queued` or marked for reclaim

**Proof**: Background job runs periodic query: `SELECT * FROM evaluation_jobs WHERE status = 'running' AND lease_until < now`, then transitions to `queued`.

---

### Invariant 7: Observable & Auditable
**State**: All state transitions, retries, worker actions, and lease renewals are logged with timestamps, worker IDs, and reason codes.

**Test**: 
1. Execute job lifecycle (claim → process → complete)
2. Audit log contains: `CLAIM`, `START`, `HEARTBEAT`, `COMPLETE` with times and worker IDs

**Proof**: Add logs to `claimJob.ts`, worker loop, and DB triggers; CI evidence captures logs in artifacts.

---

## Phase 2D Concrete Checklist

### 1. Atomic Claim Safety ✅ LOCKED (Slice 1, commit 669eeb6)
- [x] RPC uses `FOR UPDATE SKIP LOCKED` (prevents duplicate claims)
- [x] Status check before claim: `status IN ('queued', 'failed')`
- [x] Lease check: `lease_until IS NULL OR lease_until < now`
- [x] Sets `lease_token`, `heartbeat_at`, `started_at` on claim
- [x] **TEST VERIFIED**: Multi-worker concurrent claim (2 workers, 1 job, only 1 claim wins)
- [x] **TEST VERIFIED**: Lease semantics (token, expiry in future, heartbeat set)
- [x] **CI GATE**: phase2d-evidence.yml enforces on every push

### 2. Lease Renewal Mechanism ✅ (Exists but Untested)
- [x] `updateHeartbeat()` renews `lease_until = now + 5 min`
- [x] Worker heartbeat loop calls `updateHeartbeat` every 1 min
- [ ] **TEST NEEDED**: Verify heartbeat keeps worker alive; stale lease becomes reclaimable

### 3. Crash Recovery ✅ (Exists but Untested)
- [x] `releaseJob()` resets job to `queued` on shutdown
- [x] Expired lease allows reclaim by next worker
- [ ] **TEST NEEDED**: Simulate worker crash (kill -9), verify next worker can reclaim

### 4. Idempotency Guards ✅ LOCKED (Slice 2, commit pending)
- [x] Unique constraint: `unique_provider_call_per_job (job_id, provider, phase)` on `evaluation_provider_calls`
- [x] ON CONFLICT logic: worker uses upsert/update on retry to prevent duplicate rows
- [x] **TEST VERIFIED**: Double-write produces exactly one row (insert + insert fails with 23505)
- [x] **TEST VERIFIED**: Upsert pattern (ON CONFLICT DO UPDATE) handles retry gracefully
- [x] **CI GATE**: phase2d-evidence.yml enforces idempotency invariant
- [ ] Use `INSERT ON CONFLICT DO NOTHING` or `INSERT ... ON CONFLICT DO UPDATE`
- [ ] **TEST NEEDED**: Retry same chunk twice, verify result is idempotent

### 5. Retry Rules
- [ ] Define retry_count limit per job (e.g., 3 retries max)
- [ ] Only transition `failed` → `queued` if `retry_count < limit`
- [ ] Increment `retry_count` on each failure
- [ ] **TEST NEEDED**: Exceed retry limit, verify job stays `failed`

### 6. Reconciler (Sweeper Loop)
- [ ] Create background task: `SELECT * FROM evaluation_jobs WHERE status = 'running' AND lease_until < now`
- [ ] For each stale job: transition to `queued` with reason "lease_expired"
- [ ] Log each reclaim with timestamp and job ID
- [ ] **TEST NEEDED**: Create stale job, run reconciler, verify reclaimed

### 7. Failure-Simulation Tests (Evidence)
- [ ] **Multi-worker concurrent claim**: 10 workers, 5 jobs, all try to claim simultaneously
- [ ] **Lease expiry**: Job expires mid-process, next worker reclaims
- [ ] **Crash recovery**: Worker dies holding lease, reconciler reclaims
- [ ] **Retry idempotency**: Same job retried twice, effects are once
- [ ] **Double-claim prevention**: Duplicate workers claim same job, deterministic winner
- [ ] **Stuck job detection**: Job left in `running` for hours, reconciler fixes it

### 8. Observability
- [ ] Add `'CLAIM', 'HEARTBEAT', 'RENEW', 'COMPLETE', 'FAIL', 'RECLAIM', 'RECONCILE'` reason codes to logs
- [ ] Log worker_id, job_id, timestamp, and reason for each state change
- [ ] Emit metrics: claim_latency, heartbeat_renewal_count, stale_lease_reclaims
- [ ] **CI ARTIFACT**: Evidence test outputs reason codes and times

---

## Phase 2D Success Criteria

### Green on all of:
- [ ] `Invariant 1` (atomic claim) proven by concurrent test
- [ ] `Invariant 2` (lease expiry) proven by timeout + reclaim test
- [ ] `Invariant 3` (no partial writes) proven by crash test
- [ ] `Invariant 4` (idempotency) proven by retry-duplicate test
- [ ] `Invariant 5` (state machine) proven by transition table test
- [ ] `Invariant 6` (reconciler) proven by sweeper test
- [ ] `Invariant 7` (observable) proven by CI artifact audit log

### Artifacts:
- `phase2d-evidence-<commit>.log` (CI run)
- Multi-worker test results (pass count, concurrency depth)
- Reconciler test results (stale jobs detected, reclaimed)
- Audit trail (all state transitions logged)

### Branch Protection:
```yaml
Required:
  - Phase 2C Evidence Gate (type + persistence ✅)
  - Phase 2D Concurrency Gate (safety under load)
  - canon (governance)
  - Supabase-Backed Job Tests
```

---

## Next Phase (2E)

After Phase 2D is locked:
- **Phase 2E**: Exactly-once effects + Audit-grade compliance
  - Deduplication keys across retries
  - Audit log immutability
  - Compliance export (proof of "one evaluation per job")

---

This Phase 2D checklist is **ready for concrete implementation**.

