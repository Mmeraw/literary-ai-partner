# CI DB Drift Enforcement - Implementation Summary

**Date**: 2026-02-02  
**Status**: ✅ **Complete - CI-Managed Migrations + Two-Level Governance**

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

### 4. Added Proof Availability Gate (Workflow Level) ⭐
**Problem**: Entire Supabase test job was being skipped when secrets missing → green CI without proof

**Solution**: Three-job workflow pattern enforces proof availability

**Job 1: `proof-availability`**
- Checks if `SUPABASE_URL_CI` and `SUPABASE_SERVICE_ROLE_KEY_CI` secrets exist
- Outputs `secrets_ok=true/false`
- Always runs

**Job 2: `enforce-proof-on-main`**
- Depends on `proof-availability`
- Only runs on `push` to `main` branch when `secrets_ok != 'true'`
- **FAILS HARD** with explicit message about missing secrets

**Job 3: `supabase-backed-tests`**
- Depends on `proof-availability`
- Only runs if `secrets_ok == 'true'`
- Executes all proof tests (migration check, DB contract, admin retry)

**PR Ergonomics**: On PRs from forks, secrets aren't available (security model). The workflow allows this:
- `enforce-proof-on-main` only runs on `push` to `main`, not PRs
- Forks can run without secrets
- Main branch enforces proof gates strictly

### 5. Added CI-Managed Migrations ⭐ NEW
**Problem**: CI Supabase DB was drifted from repo migrations → proof gates detected drift and failed

**Solution**: Automated migration apply step in CI workflow

**New Workflow Steps**:
1. **Install Supabase CLI** (`supabase/setup-cli@v1`)
2. **Apply migrations to CI Supabase**:
   - Links to CI project using `SUPABASE_PROJECT_REF_CI`
   - Runs `supabase db push` to apply all repo migrations
   - Uses `SUPABASE_ACCESS_TOKEN` for authentication
3. **Check CI DB migrations** (existing proof gate)
   - Now validates that migrations were applied correctly
   - Should pass (DB in sync with repo)

**Required Secrets**:
- `SUPABASE_PROJECT_REF_CI`: Project reference ID for CI Supabase
- `SUPABASE_ACCESS_TOKEN`: Supabase access token with DB push permissions
- `SUPABASE_URL_CI`: Supabase project URL (existing)
- `SUPABASE_SERVICE_ROLE_KEY_CI`: Service role key (existing)

**Governance**: Every CI run now:
1. Applies repo migrations to CI DB (ensures sync)
2. Validates migrations were applied (proof gate)
3. Runs DB contract tests (proves invariants)
4. CI is green only when all three pass

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

### CI Testing - Updated Flow

**Before CI-Managed Migrations**:
- ❌ Scenario 2: Secrets present, migration missing → RED (DB drift)
- Evidence: Run 21602352426 detected drift, failed correctly

**After CI-Managed Migrations** (Current):
- ✅ Workflow auto-applies migrations before proof gates
- ✅ `check-migrations` validates migrations applied correctly
- ✅ DB contract tests and admin retry proof run against synced DB
- ✅ CI is GREEN when repo migrations match CI DB (proven automatically)

**Expected Flow**:
1. `proof-availability`: Check secrets → `secrets_ok=true`
2. `supabase-backed-tests`:
   - Install Supabase CLI
   - Apply migrations: `supabase db push`
   - Check migrations: `npm run jobs:check-migrations` → ✅ PASS
   - DB contract tests: `npm run jobs:smoke:supabase` → ✅ PASS
   - Admin retry proof: `npm run jobs:admin-retry:concurrency` → ✅ PASS
3. Result: ✅ CI GREEN (all proofs validated)

---

## Resolution Paths

### ✅ Implemented: CI-Managed Migrations (Scalable, Audit-Grade)

**What Was Added**:
- Automated migration apply step in CI workflow
- Every CI run syncs CI DB with repo migrations before running proof gates
- No manual migration management needed

**How It Works**:
1. Install Supabase CLI (`supabase/setup-cli@v1`)
2. Link to CI project (`supabase link --project-ref`)
3. Apply migrations (`supabase db push`)
4. Validate migrations (`check-ci-db-migrations.mjs`)
5. Run proof tests (DB contracts, admin retry atomicity)

**Required Configuration** (one-time setup):
```yaml
Repository Secrets:
- SUPABASE_PROJECT_REF_CI: <ci-project-ref>
- SUPABASE_ACCESS_TOKEN: <token-with-db-push-permissions>
- SUPABASE_URL_CI: <existing>
- SUPABASE_SERVICE_ROLE_KEY_CI: <existing>
```

**Benefits**:
- ✅ Eliminates manual migration management
- ✅ Proves CI DB matches repo on every run
- ✅ Scalable for future migrations
- ✅ Audit-grade: DB state is deterministic per commit

### Alternative: Manual Migration Apply (Not Used)
Manual apply was considered but rejected in favor of CI-managed approach:
```bash
# Not needed - CI now manages this automatically
supabase link --project-ref <ci-project-ref>
supabase db push --include-all
```

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
   - Modified `supabase-backed-tests` job:
     - Depends on proof-availability
     - Installs Supabase CLI
     - **Auto-applies migrations** (`supabase db push`)
     - Validates migrations applied (check-ci-db-migrations)
     - Runs proof tests
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
   - CI-managed migrations flow documented
   - Required secrets listed

---

## Acceptance Criteria

### ✅ Completed
1. **Workflow-level enforcement**: CI fails explicitly when proof gates unavailable on `main`
2. **Test-level enforcement**: Tests fail explicitly on DB drift (no silent skips)
3. **CI-managed migrations**: Automated migration apply before proof gates
4. Clear error messages with resolution paths at both levels
5. Explicit DB migration check validates sync after apply
6. PR ergonomics preserved (forks can run without secrets)
7. Governance policy documented and enforced
8. Scalable for future migrations (no manual management)

### 🎯 Next Run Will Validate
**After configuring new secrets**:
1. `supabase db push` applies repo migrations to CI DB
2. `check-migrations` validates sync → ✅ PASS
3. DB contract tests run against synced DB → ✅ PASS
4. Admin retry atomicity proof validates → ✅ PASS
5. CI is GREEN (all proofs executed and passed)

**Without new secrets** (current state):
- `Apply migrations to CI Supabase` step will fail
- Clear error: "Missing SUPABASE_PROJECT_REF_CI or SUPABASE_ACCESS_TOKEN"
- CI is RED (explicit failure, not silent skip)

---

## Next Steps

**Immediate** (to unblock CI):
1. Configure two new repository secrets:
   - `SUPABASE_PROJECT_REF_CI`: CI Supabase project reference ID
   - `SUPABASE_ACCESS_TOKEN`: Supabase access token with DB push permissions
2. Push to `main` to trigger CI
3. Verify migration apply step succeeds
4. Verify all proof gates pass
5. CI should be GREEN

**If secrets can't be configured**:
- CI will fail at "Apply migrations" step
- Error message will clearly state missing secrets
- This is correct behavior (explicit failure, not silent skip)

**Long-term**:
- Extend `check-ci-db-migrations.mjs` to validate additional critical migrations
- Add migration state to CI health checks dashboard
- Monitor drift detection for future schema changes

---

## Summary

We've **eliminated both forms of theater AND implemented automated migration management**:
1. ✅ **Test-level**: No silent skips when RPC missing/wrong
2. ✅ **Workflow-level**: No silent job skips when secrets missing
3. ✅ **CI-managed migrations**: Auto-apply repo migrations before proof gates (NEW)

The implementation now enforces **three-level audit-grade governance**:
- **Migration sync gate**: CI applies repo migrations to DB (ensures schema parity)
- **Workflow gate**: Proof availability (can we run tests?)
- **Test gate**: DB drift detection (does DB match expectations?)

**All three levels fail explicitly, never silently skip.**

**Current expected CI state**: 🔴 RED - "Missing SUPABASE_PROJECT_REF_CI or SUPABASE_ACCESS_TOKEN"  
**After secrets configured**: ✅ GREEN - "Migrations applied, all proof gates passed"

**Policy**: Green without proof is worse than red with clarity. ✅  
**Implementation**: Complete with automated migration management. ✅  
**Governance**: Audit-grade enforcement at workflow, migration, and test levels. ✅

