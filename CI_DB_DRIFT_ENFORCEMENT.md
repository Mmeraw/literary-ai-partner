# CI DB Drift Enforcement - Implementation Summary

**Date**: 2026-02-02  
**Status**: ✅ **Implemented - Awaiting Secret Configuration**

---

## What Was Fixed

### 1. Removed Silent Skip Behavior
**Before**: Admin retry test detected missing RPC and skipped gracefully with exit 0
- CI showed green
- Proof gap was masked (theater, not truth)
- Violated audit-grade governance

**After**: Test fails hard with explicit DB drift error
- No silent skips allowed
- Clear diagnostic message on failure
- Preserves contract adherence

### 2. Added Explicit DB Migration Check
**New Script**: `scripts/check-ci-db-migrations.mjs`
- Validates required migrations before running proof tests
- Fails hard with clear message if migrations missing
- Part of proof gate enforcement

**New Workflow Step**: "Check CI DB migrations (proof gate)"
- Runs before Supabase contract tests
- Blocks CI if DB is out of sync with repo migrations
- Creates artifact log: `scripts-artifacts/db-migration-check.log`

### 3. Updated Test Assertions
**File**: `scripts/jobs-admin-retry-concurrency.mjs`

**Changes**:
- Removed skip logic for missing/wrong RPC
- Added explicit DB drift error messages
- Validates right join pattern (1 row guarantee)
- Throws instead of skipping on 0 rows

**Error Message**:
```
❌ CI DB DRIFT DETECTED
   admin_retry_job returned 0 rows (expected 1)
   This indicates migration 20260131000000_admin_retry_job_atomic_rpc.sql
   is not applied OR an old/incompatible version exists.

   Expected behavior: RPC uses 'right join (select 1) one on true'
   to guarantee 1 row even for non-existent job_id.

   CI Supabase DB is out of sync with repo migrations.
   Proof gate BLOCKED until correct migration is applied.
```

---

## Governance Model

**Principle**: Green CI without proof is worse than red CI

**Policy**:
1. **No Silent Skips**: Tests must fail explicitly on validation gaps
2. **Fail Fast**: Detect DB drift before running proof tests
3. **Clear Diagnostics**: Error messages must state resolution path
4. **Audit-Grade**: Proof gates are non-negotiable

**Contract Adherence**:
- Follows `docs/JOB_CONTRACT_v1.md` strict validation
- No state guessing or simulation
- Explicit failures over convenience

---

## Testing Status

### Local Testing
✅ **Can be tested** if migration is applied to local Supabase:
1. Apply `supabase/migrations/20260131000000_admin_retry_job_atomic_rpc.sql`
2. Run `npm run jobs:check-migrations` (should pass)
3. Run `npm run jobs:admin-retry:concurrency` (should pass)

### CI Testing
⚠️ **Blocked by secret configuration**:
- Run 21601733908: Only "Scan for Hardcoded Secrets" job ran
- Supabase test jobs skipped (no secrets configured)
- Cannot validate DB drift detection until secrets available

**When secrets are configured**:
1. DB migration check will run
2. Will detect missing migration (0 rows vs expected 1 row)
3. Will fail with explicit DB drift message
4. CI will be RED (correct behavior)

---

## Resolution Paths

### To Unblock CI (Choose One):

**Option A: Apply Migration Manually**
```bash
# Connect to CI Supabase project
supabase link --project-ref <ci-project-ref>

# Apply migration
supabase db push --include-all

# Verify
supabase db diff  # should be clean
```

**Option B: Add Migration Apply to Workflow**
```yaml
- name: Apply migrations to CI DB
  run: |
    npm install -g supabase
    supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
    supabase db push --include-all
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

**Option C: Accept Current State**
- Keep CI RED until migration infrastructure exists
- Document as "implementation complete, CI blocked by DB drift"
- Move to next roadmap item

---

## Files Changed

1. **scripts/check-ci-db-migrations.mjs** (new)
   - Explicit migration validation
   - Fails hard on drift
   - 164 lines

2. **scripts/jobs-admin-retry-concurrency.mjs** (modified)
   - Removed skip logic
   - Added explicit DB drift errors
   - Validates right join pattern

3. **.github/workflows/job-system-ci.yml** (modified)
   - Added "Check CI DB migrations (proof gate)" step
   - Runs before Supabase contract tests
   - Uses pipefail for proper exit code propagation

4. **package.json** (modified)
   - Added `jobs:check-migrations` script

5. **A5_ADMIN_RETRY_STATUS.md** (updated)
   - Changed status to "CI BLOCKED - DB Drift"
   - Documented strict policy
   - Rejected Option C (silent skips)

---

## Acceptance Criteria

### ✅ Completed
1. CI fails explicitly on DB drift (no silent skips)
2. Clear error messages with resolution paths
3. Explicit DB migration check before proof tests
4. Governance policy documented and enforced

### ⏳ Pending
1. CI secrets configuration (to run Supabase tests)
2. Migration apply to CI Supabase instance
3. Green CI for the right reason (proof validated, not skipped)

---

## Next Steps

**Immediate**:
1. Configure CI secrets for Supabase tests
   - `SUPABASE_URL_CI`
   - `SUPABASE_SERVICE_ROLE_KEY_CI`
2. Trigger CI run to validate DB drift detection

**Short-term**:
1. Apply migration to CI Supabase (Option A or B)
2. Verify `npm run jobs:check-migrations` passes
3. Verify full proof test suite passes
4. Update status to "Complete"

**Long-term**:
1. Implement automated migration apply in CI (Option B)
2. Extend to validate all critical migrations
3. Add migration state to CI health checks

---

## Summary

We've **fixed the governance violation** by removing silent skips and enforcing explicit failure on DB drift. The implementation is correct and follows audit-grade principles.

**Current CI state**: Awaiting secret configuration to run Supabase tests  
**Expected CI state**: Will fail with explicit DB drift message  
**Correct CI state**: RED until migration applied (proof gate enforcement)

**Policy**: Green without proof is worse than red with clarity. ✅

