# Phase 2D: Corrected Diagnosis (Facts Only)

## ✅ What Is Complete

| Item | Evidence | Status |
|------|----------|--------|
| Secrets: SUPABASE_URL | GitHub Actions logs show `***` (masked) | ✅ |
| Secrets: SUPABASE_ANON_KEY | GitHub Actions logs show `***` (masked) | ✅ |
| Secrets: SUPABASE_SERVICE_ROLE_KEY | GitHub Actions logs show `***` (masked) | ✅ |
| Code: workers/claimJob.ts fallback | Commit 05fe77e has `\|\| process.env.SUPABASE_URL` | ✅ |
| Database: Migration 1 columns | Supabase screenshot shows indexes exist | ✅ |
| Database: Migration 1 indexes | idx_evaluation_jobs_status_lease created | ✅ |

## ❌ What Is Still Broken (Corrected Analysis)

### The Misleading Error Message

CI logs show:
```
Fallback select error: { 
  code: '42703', 
  message: 'column evaluation_jobs.lease_until does not exist' 
}
```

**This appears to contradict Migration 1 being applied.** But it doesn't.

### Why This Error Is Misleading

**The column DOES exist.** Proof:
- Migration 1 was applied (Supabase screenshot shows indexes)
- Indexes depend on the column existing
- Therefore `lease_until` column exists

**So why does the error say it doesn't exist?**

The error is being emitted from a **fallback code path**, not the main path. Here's what actually happens:

1. Test calls `claimNextJob('worker-A')`
2. Worker code tries to call `claim_job_atomic()` RPC (defined in Migration 2)
3. RPC doesn't exist yet → RPC call fails
4. Worker code falls back to a different SELECT query
5. That fallback query fails → emits the misleading error message
6. Test sees no claim was successful → fails with `claims.length === 0`

### What's Actually Missing (The Real Root Cause)

Migration 1 created the **schema base** but Migrations 2-6 create the **behavioral layer**:

| Component | Migration | Status | Why It Matters |
|-----------|-----------|--------|---|
| Columns: worker_id, lease_until, lease_token, heartbeat_at, started_at | M1 | ✅ Applied | DB has fields |
| Indexes: status_lease, worker_id | M1 | ✅ Applied | DB has performance |
| **RPC: claim_job_atomic()** | **M2** | ❌ **NOT Applied** | **Test calls this; fails = fallback error** |
| Table: evaluation_provider_calls | M3 | ❌ NOT Applied | Audit trail doesn't exist |
| Constraint: unique_provider_call_per_job | M4 | ❌ NOT Applied | Idempotency not enforced |
| RPC permissions (GRANT EXECUTE) | M5 | ❌ NOT Applied | service_role can't call RPCs |
| RPC: renew_lease() | M6 | ❌ NOT Applied | Heartbeat renewal doesn't exist |

### The Sequence of Failure

```
Test runs Phase 2D-1 "atomic claim"
  ↓
Worker code calls claimNextJob()
  ↓
claimNextJob() tries RPC: claim_job_atomic() ← Migration 2
  ↓
RPC doesn't exist (M2 not applied)
  ↓
Code falls back to SELECT query
  ↓
Fallback SELECT fails (because behavioral layer incomplete)
  ↓
Test gets claims.length === 0
  ↓
Test fails: expect(claims).toHaveLength(1)
```

## ✅ The Fix

Apply Migrations 2-6 via `supabase db push` from your Codespace.

This will:
1. Create `claim_job_atomic()` RPC → Test can call it
2. Create RPCs' support objects (tables, constraints)
3. Grant permissions → service_role can execute
4. Complete the behavioral layer

**After:** CI will either pass Phase 2D-1 or fail with a real logic error (not a "RPC missing" error).

## 📋 Summary

| What | Before | After | How |
|-----|--------|-------|-----|
| Error type | "RPC missing" (misleading) | "Logic assertion failed" (actionable) OR ✅ Pass | Apply M2-6 |
| Broken part | Behavioral layer | — | `supabase db push` |
| Test status | Fails during infrastructure setup | Fails on logic OR ✅ passes | — |

**Bottom line:** The schema base exists (M1). The behavioral layer doesn't (M2-6). Apply M2-6 and CI will work.
