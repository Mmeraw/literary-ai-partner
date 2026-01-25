# Test 6: Concurrent Lease Contention - VERIFIED

**Date**: 2026-01-25  
**Commit**: 8826f98  
**Status**: ✅ PASS

---

## Test Execution

**Script**: `scripts/run-test-6.sh`  
**Job ID**: 6a3b5a00-629e-44f2-9ad5-244772d913df  
**Timestamp**: 2026-01-25 19:52:24 UTC

### Test Procedure

1. Created fresh job via SQL (status='queued', phase='phase_0')
2. Launched 3 workers simultaneously with unique IDs
3. Each worker attempted atomic lease acquisition
4. Captured individual worker outputs
5. Verified final job state in database

---

## Worker Outputs (Actual Evidence)

### Worker 1
```
worker-1: Attempting to acquire lease 7e1fbba4-5dff-434a-a614-1126340acbf6 for job 6a3b5a00-629e-44f2-9ad5-244772d913df
worker-1: ❌ Failed to acquire lease (lost race)
```
**Exit code**: 1 (expected for loser)

### Worker 2
```
worker-2: Attempting to acquire lease 16df794b-8788-4c4e-8cdd-7d0a73a15075 for job 6a3b5a00-629e-44f2-9ad5-244772d913df
worker-2: ✅ LEASE ACQUIRED - lease_id=16df794b-8788-4c4e-8cdd-7d0a73a15075
```
**Exit code**: 0 (winner)

### Worker 3
```
worker-3: Attempting to acquire lease ea4d28a2-9455-4093-bddd-e01df08a8197 for job 6a3b5a00-629e-44f2-9ad5-244772d913df
worker-3: ❌ Failed to acquire lease (lost race)
```
**Exit code**: 1 (expected for loser)

---

## Database Verification

**Query run**: 2026-01-25 19:52:30 UTC

```sql
SELECT id, status, 
       progress->>'lease_id' as lease_id,
       progress->>'lease_expires_at' as lease_expires_at,
       progress->>'phase' as phase,
       progress->>'phase_status' as phase_status
FROM public.evaluation_jobs
WHERE id = '6a3b5a00-629e-44f2-9ad5-244772d913df';
```

**Result**:
```
Job ID:       6a3b5a00-629e-44f2-9ad5-244772d913df
Status:       running
Lease ID:     16df794b-8788-4c4e-8cdd-7d0a73a15075  <-- Worker 2's lease
Lease Expires: 2026-01-25T19:52:24.099Z
Phase:        phase1
Phase Status: running
```

---

## Pass Criteria ✅

| Criterion | Expected | Actual | Result |
|-----------|----------|--------|--------|
| **Exactly one winner** | 1 worker acquires lease | Worker 2 acquired | ✅ PASS |
| **Losers fail cleanly** | 2 workers report "lost race" | Workers 1 & 3 failed | ✅ PASS |
| **No duplicate leases** | Single lease_id in DB | Only Worker 2's lease present | ✅ PASS |
| **Job status transition** | Status changes to 'running' | Status = running | ✅ PASS |
| **Phase progression** | Phase advances to phase1 | Phase = phase1 | ✅ PASS |

---

## Key Observations

1. **Atomic lease enforcement**: Only worker-2's lease_id (16df794b...) appears in the database
2. **Clean failure mode**: Workers 1 and 3 exited with code 1 and "lost race" message (expected behavior)
3. **No retry storms**: Losers backed off immediately without hammering the database
4. **State consistency**: Job transitioned from queued→running with exactly one lease holder

---

## Technical Implementation (test-worker-lease.mjs)

The concurrency safety mechanism:

```javascript
// 1. Read current job state
const { data: job } = await supabase
  .from('evaluation_jobs')
  .select('id, status, progress, updated_at')
  .eq('id', JOB_ID)
  .single();

// 2. Check eligibility (status='queued', no active lease)
if (job.status !== 'queued') {
  return false; // Not eligible
}

// 3. Attempt atomic update with optimistic lock
const { data: updated } = await supabase
  .from('evaluation_jobs')
  .update({
    progress: { ...job.progress, lease_id, lease_expires_at },
    status: 'running',
    updated_at: new Date().toISOString(),
  })
  .eq('id', JOB_ID)
  .eq('status', 'queued')
  .eq('updated_at', job.updated_at)  // ← Optimistic lock
  .select('id, progress')
  .maybeSingle();

// 4. Winner gets data, losers get null
return updated !== null;
```

**Why this works**:
- PostgreSQL enforces row-level locks on UPDATE
- The `.eq('updated_at', job.updated_at)` condition fails for all but the first writer
- MVCC (Multi-Version Concurrency Control) ensures losers see consistent state
- No database-level RPC needed; application-level optimistic locking sufficient

---

## Evidence Preservation

**Log files**:
- `/tmp/worker-1.log` - Worker 1 attempt
- `/tmp/worker-2.log` - Worker 2 (winner)
- `/tmp/worker-3.log` - Worker 3 attempt
- `/tmp/test6-evidence.log` - Full test output

**Database snapshot**: Captured via SQL query at 2026-01-25 19:52:30 UTC

**Script**: `scripts/run-test-6.sh` (executable test harness, no API dependencies)

---

## Conclusion

**Test 6: PASS ✅**

Concurrent lease contention behaves correctly:
- Atomic acquisition via optimistic locking
- Exactly one winner per job
- Clean failure for losers (no exceptions, no retries)
- Database state consistent with architecture design

**Foundation Status**: Test 6 verified with execution evidence.
