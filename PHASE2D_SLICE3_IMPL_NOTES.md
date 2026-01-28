# Phase 2D-3 Implementation Notes

## Root Cause: Migration Conflict (jobs vs evaluation_jobs)

**Problem**: Slice 3 tests failed with "Could not find heartbeat_at column" despite migration existing.

**Diagnosis**:
- Found 3 `claim_job_atomic` RPC definitions:
  1. `20260127_claim_job_atomic.sql` - targets `jobs` table
  2. `20260127_fix_claim_job_atomic.sql` - targets `jobs` table (obsolete)
  3. `20260128_fix_claim_job_atomic_eval_jobs.sql` - targets `evaluation_jobs` table (canonical)

- PostgreSQL function overloading allowed both to coexist with different signatures
- Worker code calls 3-arg version `(TEXT, TIMESTAMPTZ, INTEGER)` targeting `evaluation_jobs`
- But `supabase db reset` showed output from 3-arg version targeting `jobs`
- PostgREST schema cache reflected wrong table

**Fix Applied**:
1. Renamed obsolete migrations:
   - `20260127_claim_job_atomic.sql` → `.obsolete_20260127_claim_job_atomic.sql`
   - `20260127_fix_claim_job_atomic.sql` → `.obsolete_20260127_fix_claim_job_atomic.sql`
2. Now only `20260128_fix_claim_job_atomic_eval_jobs.sql` applies
3. `supabase db reset` now applies correct RPC targeting `evaluation_jobs` with lease fields

**Verification**:
- [x] Obsolete migrations skipped (Supabase logs show "file name must match pattern")
- [x] Canonical RPC targets `evaluation_jobs`
- [x] Sets `heartbeat_at`, `lease_token`, `lease_until` on claim
- [ ] Tests run green (pending Supabase start + env setup)

## Slice 3 Mechanics

**Implemented**:
- `renewLease(jobId, workerId, leaseToken)`: Token-verified lease renewal via `renew_lease` RPC
- `reconcileExpiredLeases(maxBatch)`: Reclaims jobs where `lease_until < now`
- Tests (4 total):
  1. `renewLease` with correct token extends lease + updates heartbeat
  2. `renewLease` with wrong token fails (prevents theft)
  3. Expired lease can be reclaimed by different worker
  4. Healthy lease cannot be stolen
  5. `reconcileExpiredLeases` resets stale running jobs to queued

**Evidence Script Updated**:
- Banner: "PHASE 2D SLICES 1–3 EVIDENCE"
- Schema fingerprint includes `renew_lease` RPC
- Runs `phase2d3-reconciler-proof.test.ts`
- Lock message: "✅ PHASE 2D SLICES 1–3 LOCKED"

**Workflow Updated**:
- Triggers on `phase2d3-reconciler-proof.test.ts` changes
- Summary shows "Phase 2D-3 Reconciler | ✅ 4/4 tests"

**Next**: Local test run to verify all 4 tests pass against corrected schema.
