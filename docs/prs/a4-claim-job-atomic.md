## PR Description

**A4 — fix claim_job_atomic RPC overload resolution + started_at ambiguity + CI hygiene**

This PR fixes multiple compound failures in the Job System CI caused by PostgREST RPC overload resolution issues and SQL ambiguity in the canonical `claim_job_atomic` function.

### Key Fixes

- **PostgREST overload disambiguation**: Renamed compat wrapper parameters from `p_*` to `c_*` prefix to ensure named-arg RPC calls `{p_worker_id, p_now, p_lease_seconds}` resolve deterministically to the canonical overload only
- **SQL ambiguity resolution**: Qualified `started_at` column references with table alias in UPDATE statement to eliminate PL/pgSQL variable/column conflict under `RETURNS TABLE`
- **CI test hygiene**: Enhanced smoke test cleanup to delete stale queued jobs (>5min old) before running RPC signature tripwire, preventing false positives from leftover test data. _(Cleanup runs only in CI smoke test harness, not in production runtime.)_
- **Canonical signature guarantee**: Added migration to ensure canonical `(text, timestamptz, integer)` overload exists in CI even under drift scenarios
- **Workflow robustness**: Made PostgREST schema reload best-effort with graceful degradation; smoke tests are authoritative

### Migrations Applied

- `20260207000011`: Fix compat wrapper infinite recursion via positional delegation
- `20260207000012`: Guarantee canonical function exists in CI
- `20260207000015/000016`: Drop and recreate compat overload with `c_*` parameter names
- `20260207000017`: Resolve `started_at` ambiguity with table alias qualification

### CI Status

✅ **All tests passing** (run #328)
- Job System Smoke Tests & Invariants: ✅
- Supabase-Backed Contract Tests: ✅
- Admin Retry Concurrency: ✅
- RPC signature tripwire: ✅
- Claim contention: ✅
- Lease blocking: ✅

**Ready to merge.**
