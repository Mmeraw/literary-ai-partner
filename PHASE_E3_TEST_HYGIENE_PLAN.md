# Phase E3: Test Hygiene Plan

**Status**: Ready to Start  
**Blocking Tests**: 10 suites (12 failed tests, various issues)  
**Estimated Effort**: 4-6 hours  
**Post-E3**: Enable branch protection on CI workflow

---

## Quick Status

**Currently Passing**: 10 test suites (220 tests) ✅  
**Currently Failing**: 12 test suites (28 tests) ❌  
**Total Coverage**: 22 suites, 248 tests

---

## Failing Test Suites (Categorized by Issue Type)

### Category A: Missing Dependencies

**Tests**:
- `__tests__/phase_d/d2_agent_trust_header.test.tsx`

**Error**:
```
Cannot find module '@testing-library/react'
```

**Fix**:
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```

**Effort**: 5 minutes

---

### Category B: Missing Test Fixtures

**Tests**:
1. `__tests__/phase_d/d1_user_safe_errors.test.ts`
   - Missing: `evidence/phase-d/d1/http-error-fixtures.json`

2. `__tests__/phase_d/d3_rate_limits.test.ts`
   - Missing: `evidence/phase-d/d3/rate-limit-fixtures.json`

**Current Evidence Files** (check if they exist):
```bash
ls -la evidence/phase-d/
# Should have d1/, d2/, d3/, d4/, d5/ directories
```

**Fix Options**:
1. If fixtures exist in evidence/, link them (symlink or copy)
2. If fixtures need creation, create minimal test data files

**Effort**: 15 minutes (recovery) or 30 minutes (creation)

---

### Category C: Database Schema Issues in CI

**Tests**:
1. `phase2d1-atomic-claim-concurrency.test.ts`
   - Missing table: `public.evaluation_provider_calls`
   - Error: `PGRST205` - Table not found

2. `phase2d2-idempotency-proof.test.ts`
   - Missing table: `public.evaluation_provider_calls`

3. `phase2d3-reconciler-proof.test.ts`
   - Missing column: `heartbeat_at` in `evaluation_jobs` table

**Root Cause**:
CI uses local Supabase instance, but migration not running or schema incomplete.

**Fix**:
```bash
# In CI workflow (.github/workflows/job-system-ci.yml or ci.yml):
# Add migration step before running tests
supabase db push  # Or similar migration command
```

**Alternative**:
Create minimal test setup that seeds required tables/columns.

**Effort**: 20 minutes (add migration) or 45 minutes (manual setup)

---

### Category D: Test Isolation Issues

**Tests**:
1. `phase2d1-atomic-claim-concurrency.test.ts`
2. `phase2d2-idempotency-proof.test.ts`
3. `phase2d3-reconciler-proof.test.ts`

**Issue**:
Tests assume database state/cleanup isn't happening properly between tests.

**Example**:
```
"Cannot claim job" - expects job in specific state but previous test left it elsewhere
```

**Fix**:
1. Add `beforeEach()` to clean up test data
2. Use unique IDs per test (UUID suffix)
3. Add `afterEach()` to reset state
4. Ensure transactions rolled back

**Pattern**:
```typescript
beforeEach(async () => {
  // Clean up from previous test
  await db.from('evaluation_jobs').delete();
  await db.from('evaluation_provider_calls').delete();
});

afterEach(async () => {
  // Cleanup after this test
  await db.from('evaluation_jobs').delete();
});
```

**Effort**: 30 minutes per test

---

## Fix Priority Order

### Priority 1: Dependencies (5 min) ✅ Easy Win
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
```
Unblocks: 1 test suite

### Priority 2: Test Fixtures (15-30 min) ✅ High Impact
```bash
# Verify evidence files exist
ls evidence/phase-d/d{1,3}/

# If missing, check if fixtures should be auto-generated or restored
grep -r "http-error-fixtures" __tests__/ lib/
grep -r "rate-limit-fixtures" __tests__/ lib/
```
Unblocks: 2 test suites

### Priority 3: CI Database Setup (20 min) ✅ Critical
Add to `.github/workflows/job-system-ci.yml`:
```yaml
- name: Setup Supabase
  run: |
    supabase db reset  # Use local test data
    # OR run migrations
    npm run migrate:test
```
Unblocks: 3 test suites

### Priority 4: Test Isolation (90 min) ✅ Quality
Add cleanup to each test:
```typescript
beforeEach(async () => {
  // Fresh database state
});
afterEach(async () => {
  // Clean up test data
});
```
Fixes: 3 test suites

---

## Testing Verification Checklist

After each fix, verify with:

```bash
# Run single test file
npm test -- phase2d1-atomic-claim-concurrency.test.ts

# Run all phase_d tests
npm test -- __tests__/phase_d/

# Run full suite (with observability logging)
npm run test:ci
```

---

## Expected Outcome

**After E3 Completion**:
- ✅ All 22 test suites passing
- ✅ 248 tests all green
- ✅ CI workflow shows green checkmark
- ✅ Branch protection can be enabled on CI
- ✅ Production-grade test coverage

---

## Implementation Steps (Detailed)

### Step 1: Install Missing Dependencies (5 min)

```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm test -- d2_agent_trust_header
```

Expected: ✅ PASS

### Step 2: Restore Test Fixtures (15-30 min)

```bash
# Check what's needed
cat __tests__/phase_d/d1_user_safe_errors.test.ts | grep "require.*fixtures"
cat __tests__/phase_d/d3_rate_limits.test.ts | grep "require.*fixtures"

# Create/restore files
mkdir -p evidence/phase-d/d1
mkdir -p evidence/phase-d/d3

# Either:
# Option A: Restore from git history
git show HEAD~10:evidence/phase-d/d1/http-error-fixtures.json > evidence/phase-d/d1/http-error-fixtures.json

# Option B: Create minimal fixtures
echo '{}' > evidence/phase-d/d1/http-error-fixtures.json
echo '[]' > evidence/phase-d/d3/rate-limit-fixtures.json
```

Then update tests if fixture format changed.

Expected: ✅ PASS or specific error about fixture content

### Step 3: Fix CI Database Setup (20 min)

Edit `.github/workflows/job-system-ci.yml`:

```yaml
- name: Start Supabase
  run: |
    supabase start
    
- name: Run Migrations
  run: |
    supabase db push
    # OR if using custom migrations:
    # npm run db:migrate:test

- name: Seed Test Data (if needed)
  run: |
    # Run setup script
    npm run db:seed:test
```

Verify locally:
```bash
supabase start
npm run test:ci
```

Expected: ✅ PASS

### Step 4: Add Test Isolation (90 min)

For each phase2d test, add:

```typescript
describe('Phase 2D-X ...', () => {
  let cleanup: (() => Promise<void>)[] = [];

  beforeEach(async () => {
    // Start fresh
    await admin
      .from('evaluation_jobs')
      .delete()
      .neq('id', 'nonexistent'); // Delete all
      
    await admin
      .from('evaluation_provider_calls')
      .delete()
      .neq('id', 'nonexistent');
  });

  afterEach(async () => {
    // Run any cleanup registered
    for (const fn of cleanup) {
      await fn();
    }
    cleanup = [];
  });

  test('specific test...', async () => {
    // Test code
    cleanup.push(async () => {
      // This test's specific cleanup
    });
  });
});
```

Run per-test verification:
```bash
npm test -- phase2d1-atomic-claim-concurrency
npm test -- phase2d2-idempotency-proof
npm test -- phase2d3-reconciler-proof
```

Expected: ✅ All PASS

---

## Observability During E3 Testing

With Phase E2 observability in place, debugging test failures is easier:

1. **Job Creation Failures**: Check logs for `api.jobs.create.error`
2. **Database Issues**: Check for missing column/table logs
3. **Auth Failures**: Look for `api.jobs.create.access_denied` events
4. **Race Conditions**: Search by `request_id` to see concurrent operations

```bash
# In CI logs, search for:
trace_id: "abc123..." AND event: "api.jobs.*"
```

---

## Post-E3: Branch Protection

Once all tests pass:

```bash
# Push to GitHub
git push origin main

# GitHub Settings → Branch protection
# Require: Phase 2D Evidence workflow, Phase 2C Evidence, CI workflow
```

---

## Estimated Timeline

| Task | Time | Cumulative |
|------|------|-----------|
| Dependencies | 5 min | 5 min |
| Fixtures | 25 min | 30 min |
| CI Database | 20 min | 50 min |
| Test Isolation | 90 min | 140 min |
| Verification | 30 min | 170 min |
| **Total** | **~3 hours** | |

**Includes**: 5 test runs, debugging, validation

---

## Success Criteria

✅ All 22 test suites run without errors  
✅ All 248 tests passing (0 failures)  
✅ CI workflow shows all green ✅  
✅ Tests run in <20 seconds  
✅ Observability logs are clean (no spurious errors)  
✅ Branch protection can be enabled without failures

---

## Known Issues & Workarounds

### Issue: Supabase local instance won't start
**Workaround**: Use test database environment variable
```bash
export DATABASE_URL="postgresql://..."
```

### Issue: Tests still fail after cleanup
**Check**: 
1. Are tests creating conflicting IDs?
2. Is database state persisting across test runs?
3. Are there foreign key constraints?

**Fix**: Add explicit unique IDs:
```typescript
const testId = `test_${Date.now()}_${Math.random()}`;
```

### Issue: Timeout waiting for database
**Check**: Is Supabase actually running? 
```bash
ps aux | grep supabase
supabase status
```

**Fix**: Restart and add 5-second wait
```bash
supabase stop && supabase start && sleep 5 && npm test
```

---

## Questions to Answer During E3

1. **Database state**: How much setup is needed?
2. **Fixture format**: Are the fixtures in the right format?
3. **Dependency versions**: Do all @testing-library/* versions compatible?
4. **Test performance**: Are tests running in <1s each?

---

## Resources

- **Test files**: `__tests__/` and `*.test.ts` files
- **Phase 2D Evidence**: `PHASE2D_CLOSURE_BRANCH_PROTECTION.md`
- **Observability for debugging**: `PHASE_E2_OBSERVABILITY_COMPLETE.md`
- **Job contract**: `docs/JOB_CONTRACT_v1.md`

---

## Next: E4 (Future)

After E3 passes:
- Add integration tests for observability paths
- Add performance benchmarks
- Add load testing scenarios
- Set up dashboards for metrics

---

**Status**: Ready to start Phase E3. All blockers identified and documented.

