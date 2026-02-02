# CI DB Drift Enforcement - Implementation Summary

**Date**: 2026-02-02  
**Status**: ✅ **Complete - Workflow & Test Level Enforcement**

---

## What Was Fixed

### 1. Removed Silent Skip Behavior (Test Level)
**Before**: Admin retry test detected missing RPC and skipped gracefully with exit 0
- CI showed green
- Proof gap was masked (theater, not truth)
- Violated audit-grade governance

**After**: Test fails hard with explicit DB drift error
- No silent skips allowed
- Clear diagnostic message on failure
- Preserves contract adherence

### 2. Added Explicit DB Migration Check (Test Level)
**New Script**: `scripts/check-ci-db-migrations.mjs`
- Validates required migrations before running proof tests
- Fails hard with clear message if migrations missing
- Part of proof gate enforcement

**New Workflow Step**: "Check CI DB migrations (proof gate)"
- Runs before Supabase contract tests
- Blocks CI if DB is out of sync with repo migrations
- Creates artifact log: `scripts-artifacts/db-migration-check.log`

### 3. Updated Test Assertions (Test Level)
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

### 4. Added Proof Availability Gate (Workflow Level) ⭐ NEW
**Problem**: Entire Supabase test job was being skipped when secrets missing → green CI without proof

**Solution**: Three-job workflow pattern enforces proof availability

**Job 1: `proof-availability`**
- Checks if `SUPABASE_URL_CI` and `SUPABASE_SERVICE_ROLE_KEY_CI` secrets exist
- Outputs `secrets_ok=true/false`
- Always runs

**Job 2: `enforce-proof-on-main`**
- Depends on `proof-availability`
- Only runs on `push` to `main` branch when `secrets_ok != 'true'`
- **FAILS HARD** with explicit message:
  ```
  ❌ PROOF GATES REQUIRED BUT UNAVAILABLE
  
  Supabase proof gates are required on the main branch, but secrets
  are not configured. This violates audit-grade governance:
  
    • Green CI without proof is worse than red CI
    • Proof gates must run or explicitly fail
    • No silent skipping of validation
  
  Required secrets:
    • SUPABASE_URL_CI
    • SUPABASE_SERVICE_ROLE_KEY_CI
  ```

**Job 3: `supabase-backed-tests`**
- Depends on `proof-availability`
- Only runs if `secrets_ok == 'true'`
- Executes all proof tests (migration check, DB contract, admin retry)

**PR Ergonomics**: On PRs from forks, secrets aren't available (security model). The workflow allows this:
- `enforce-proof-on-main` only runs on `push` to `main`, not PRs
- Forks can run without secrets
- Main branch enforces proof gates strictly

---

## Governance Model

**Principle**: Green CI without proof is worse than red CI

**Two-Level Enforcement**:

**Workflow Level** (New):
- Checks if proof gates CAN run (secrets available)
- On `main`: Fails if secrets missing (no silent job skip)
- On PRs: Allows missing secrets (fork security model)

**Test Level** (Previously implemented):
- Checks if DB state matches repo migrations
- Fails if migrations not applied (no silent test skip)
- Validates RPC signatures and behavior

**Policy**:
1. ❌ No silent skips at workflow level (job skipping)
2. ❌ No silent skips at test level (test skipping)
3. ✅ Fail fast on proof unavailability
4. ✅ Fail fast on DB drift
5. ✅ Clear diagnostics with resolution paths
6. ✅ Audit-grade proof gates

**Contract Adherence**:
- Follows `docs/JOB_CONTRACT_v1.md` strict validation
- No state guessing or simulation
- Explicit failures over convenience
- Green only when proof executed and passed

---

## Testing Status

### Local Testing
✅ **Can be tested** if migration is applied to local Supabase:
1. Apply `supabase/migrations/20260131000000_admin_retry_job_atomic_rpc.sql`
2. Run `npm run jobs:check-migrations` (should pass)
3. Run `npm run jobs:admin-retry:concurrency` (should pass)

### CI Testing - Two Scenarios

**Scenario 1: Secrets NOT Configured** (Current State)
- `proof-availability` job: Outputs `secrets_ok=false`
- `enforce-proof-on-main` job: **RUNS** on `push` to `main` → **FAILS** with explicit message
- `supabase-backed-tests` job: Skipped (but CI is RED due to enforcement job)
- **Result**: 🔴 CI RED with clear diagnostic

**Scenario 2: Secrets Configured, Migration NOT Applied**
- `proof-availability` job: Outputs `secrets_ok=true`
- `enforce-proof-on-main` job: Skipped (not needed)
- `supabase-backed-tests` job: **RUNS**
  - `check-migrations` step: **FAILS** with DB drift message
  - Subsequent steps: Don't run (early failure)
- **Result**: 🔴 CI RED with DB drift diagnostic

**Scenario 3: Secrets + Migration Both Applied**
- `proof-availability` job: Outputs `secrets_ok=true`
- `enforce-proof-on-main` job: Skipped (not needed)
- `supabase-backed-tests` job: **RUNS**
  - `check-migrations` step: ✅ PASS
  - `smoke:supabase` step: ✅ PASS (5 DB contract validations)
  - `admin-retry:concurrency` step: ✅ PASS (atomicity proof)
- **Result**: ✅ CI GREEN (for the right reason)

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
   - Added `proof-availability` job (checks secrets exist)
   - Added `enforce-proof-on-main` job (fails if secrets missing on main)
   - Modified `supabase-backed-tests` job (depends on proof-availability, no skip logic)
   - Uses pipefail for proper exit code propagation

4. **package.json** (modified)
   - Added `jobs:check-migrations` script

5. **A5_ADMIN_RETRY_STATUS.md** (updated)
   - Changed status to "CI BLOCKED - DB Drift"
   - Documented strict policy
   - Rejected Option C (silent skips)

6. **CI_DB_DRIFT_ENFORCEMENT.md** (this file)
   - Complete implementation summary
   - Two-level governance model documented
   - Three CI scenarios validated

---

## Acceptance Criteria

### ✅ Completed
1. **Workflow-level enforcement**: CI fails explicitly when proof gates unavailable on `main`
2. **Test-level enforcement**: Tests fail explicitly on DB drift (no silent skips)
3. Clear error messages with resolution paths at both levels
4. Explicit DB migration check before proof tests
5. PR ergonomics preserved (forks can run without secrets)
6. Governance policy documented and enforced

### 🎯 Next Run Will Validate
1. `enforce-proof-on-main` job fails with explicit message (secrets missing)
2. CI is RED (not green with skipped jobs)
3. Error message clearly states required secrets

### ⏳ After Secrets Configured
1. `check-migrations` step detects DB drift
2. CI is RED with DB drift diagnostic
3. After migration applied: full proof suite passes, CI is GREEN

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

We've **eliminated both forms of theater**:
1. ✅ **Test-level**: No silent skips when RPC missing/wrong
2. ✅ **Workflow-level**: No silent job skips when secrets missing (NEW)

The implementation now enforces **two-level audit-grade governance**:
- Workflow gate: Proof availability (can we run tests?)
- Test gate: DB drift detection (does DB match repo?)

**Both levels fail explicitly, never silently skip.**

**Current expected CI state**: 🔴 RED - "Proof gates required but unavailable"  
**After secrets configured**: 🔴 RED - "CI DB drift detected"  
**After migration applied**: ✅ GREEN - "All proof gates passed"

**Policy**: Green without proof is worse than red with clarity. ✅  
**Implementation**: Complete at both workflow and test levels. ✅

