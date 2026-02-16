# A5: Admin Retry Atomicity — Status Report

**Date**: 2026-02-02 (created) · 2026-02-16 (updated)

**Status**: ✅ **A5 Day 1 COMPLETE — CI GREEN**

---

## Executive Summary

The admin retry RPC (`admin_retry_job`) is fully implemented with atomic guarantees, a comprehensive concurrency test suite, and **all CI gates pass green**. The DB drift that previously blocked CI has been resolved — the Job System CI workflow now applies migrations via `supabase db push --linked` before running tests.

**Gate A5 Day 1 is closed.** All deliverables are merged to `main`.

**Current State**:
- ✅ Implementation: Complete and correct
- ✅ Local Testing: Full concurrency proof passes
- ✅ CI Validation: **GREEN — all 7 workflows pass** (run #537, commit `2414d55`)
- ✅ CI Truthfulness: Proof gate enforces migration parity (no silent skips)
- ✅ Gate A4 Closure: Documented in `GOLDEN_SPINE_GATE_LEDGER.md`

---

## Resolution History

### DB Drift (resolved 2026-02-15)

**Root cause**: The CI Supabase instance was missing the `admin_retry_job` RPC migration. The `job-system-ci.yml` workflow did not apply pending migrations before running tests.

**Fix**: Added `npx supabase db push --linked` step to `.github/workflows/job-system-ci.yml` before the test execution step. This ensures CI always runs against the latest schema.

**Verification**: CI run #537 (commit `2414d55`) — all 7 workflows green, including Job System CI #537 (1m 35s).

---

## Implementation Details

### RPC Function

**File**: `supabase/migrations/20260131000000_admin_retry_job_atomic_rpc.sql`

**Signature**:
```sql
admin_retry_job(p_job_id uuid)
RETURNS table(job_id uuid, status text, changed boolean)
```

**Atomicity Guarantees**:
- Uses CTE pattern with UPDATE + WHERE conditions in single statement
- Only resets jobs in retryable states (`failed`, `dead_lettered`)
- Respects active leases (prevents retry of in-flight work)
- Resets `attempt_count` to 0, clears worker/error state
- Returns `changed=true` on success, `changed=false` if no-op
- Right join pattern ensures 1 row always returned (even for non-existent job)

**State Transitions**:
```
failed|dead_lettered → queued (if lease expired)
queued|running → no-op (changed=false, idempotent)
```

### Test Suite

**File**: `scripts/jobs-admin-retry-concurrency.mjs`

**Coverage**:
1. **RPC Signature Validation**: Confirms return shape (job_id, status, changed)
2. **Parallel Retry Contention**: Fires 2 concurrent RPCs, validates exactly 1 succeeds
3. **State Consistency**: Validates attempt_count reset, status transition, timestamp updates
4. **Idempotency**: Proves retrying queued job returns changed=false (no duplicate work)

**Mistake-Proof Design**:
- Uses `process.exitCode` + `console.error()` for proper exit codes
- `setImmediate(() => process.exit())` flushes logs before termination

---

## A5 Day 1 Deliverables (shipped in commit `39d84f5`)

- ✅ `lib/jobs/retry.ts` — admin retry wrapper with typed response
- ✅ `lib/jobs/backpressure.ts` — queue depth + oldest-age queries
- ✅ `app/api/admin/jobs/retry/route.ts` — POST endpoint for admin retry
- ✅ `app/api/admin/jobs/stats/route.ts` — GET endpoint for queue stats
- ✅ `scripts/verify-phase-a5-day1.sh` — verification script (passes)

---

## Next: A5 Day 2 — Backpressure & Cost Visibility

**Branch**: `feat/a5-day2-backpressure-cost`

**Deliverables**:
1. `lib/jobs/cost-tracker.ts` — per-job cost accumulation
2. `app/api/admin/jobs/costs/route.ts` — cost visibility endpoint
3. `components/admin/JobCostDashboard.tsx` — cost dashboard UI
4. Backpressure threshold configuration + enforcement
5. `scripts/verify-phase-a5-day2.sh` — verification script
