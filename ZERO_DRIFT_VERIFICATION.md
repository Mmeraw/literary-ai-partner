# Zero-Drift Job System Verification

**Status**: ✅ **LOCKED AND VERIFIED**  
**Last Verified**: Run `npm run verify:zero-drift` to re-verify  
**Provable Commit**: Run `git rev-parse HEAD`

---

## Provable Commit State

```bash
$ git rev-parse HEAD
$ git show -s --format=fuller HEAD
$ git log --oneline -n 5
```

---

## Single Source of Truth (Provable)

### ✅ Auth Logic
**Location**: `lib/jobs/rateLimiter.ts:checkFeatureAccess()`

**Verification**:
```bash
$ rg -n "ALLOW_HEADER_USER_ID" lib/jobs/rateLimiter.ts lib/jobs/config.ts
# Expected: Gate logic in rateLimiter.ts + fail-safe assert in config.ts

$ rg -n "checkFeatureAccess\\(" app/api/jobs lib/jobs
# Expected: All job endpoints use checkFeatureAccess()
```

**Production Fail-Safe**:
```bash
$ rg -n "SECURITY VIOLATION" lib/jobs/config.ts
# Expected: Startup assert that throws in production if bypass enabled
```

### ✅ HTTP Helpers
**Location**: `scripts/_http.mjs`

**Verification**:
```bash
$ rg "from \"\\.\\/(_http)\\.mjs\"|import.*_http" scripts
# Expected: 4 matches (smoke, phase2, contention, cancel)

$ rg -n "^function must|^async function must" scripts/jobs-*.mjs
# Expected: 0 matches (all import from _http.mjs)

$ rg -n "^function sleep|^const sleep\s*=" scripts/jobs-*.mjs
# Expected: 0 matches (all import from _http.mjs)
```

### ✅ Skip Logic
**Location**: `scripts/_skip.mjs`

**Verification**:
```bash
$ rg "from \"\\.\\/(_skip)\\.mjs\"|import.*_skip" scripts
# Expected: 4 matches (smoke, phase2, contention, cancel)

$ rg -n 'USE_SUPABASE_JOBS !== "false".*process\.exit\(0\)' scripts/jobs-*.mjs
# Expected: 0 matches (all use skipIfMemoryMode)
```

---

## Zero Manual Duplication (Provable)

### ❌ No Hardcoded `x-user-id` Headers

```bash
$ rg "x-user-id" scripts/jobs-*.mjs
# Expected: 0 matches (all use jfetch which auto-adds header)
# Note: _http.mjs contains the definition, excluded from this check
```

### ❌ No Manual Helper Functions

```bash
$ rg -n "^function must|^async function must" scripts/jobs-*.mjs
# Expected: 0 matches

$ rg -n "^function sleep|^const sleep" scripts/jobs-*.mjs
# Expected: 0 matches
```

### ❌ No Manual Skip Logic

```bash
$ rg -n "process\.exit\(0\)" scripts/jobs-*.mjs | grep -v skipIfMemoryMode
# Expected: 0 matches
```

---

## CI Contract (Provable)

### ✅ All Workflows Passing

```bash
$ gh run list --repo Mmeraw/literary-ai-partner \
    --workflow="Job System CI" --limit 3 \
    --json conclusion,displayTitle,createdAt
```

### ✅ Drift Tripwire Active

**File**: `.github/workflows/job-system-ci.yml`

```yaml
- name: Verify zero-drift (no manual duplication)
  run: npm run verify:zero-drift
```

**Script**: `scripts/verify-zero-drift.sh`

Checks:
1. No hardcoded `x-user-id` headers
2. No manual `must()` functions
3. No manual `sleep()` functions
4. No manual skip logic

**Test locally**:
```bash
$ npm run verify:zero-drift
🔍 Drift Tripwire: Checking for banned patterns...
  [1/4] Checking for hardcoded auth headers... ✅ PASS
  [2/4] Checking for manual must() functions... ✅ PASS
  [3/4] Checking for manual sleep() functions... ✅ PASS
  [4/4] Checking for manual skip logic... ✅ PASS

✅ All tripwire checks passed - no drift detected
```

### ✅ Production Fail-Safe

**Location**: `lib/jobs/config.ts`

```typescript
if (process.env.NODE_ENV === "production") {
  if (process.env.ALLOW_HEADER_USER_ID === "true") {
    throw new Error("SECURITY VIOLATION: ALLOW_HEADER_USER_ID must never be enabled in production.");
  }
}
```

**Enforcement**: Imported by `lib/jobs/rateLimiter.ts` on module load (top-level).  
**Coverage**: All job endpoints import rateLimiter → all endpoints protected.  
**Result**: Server cannot start if misconfigured.

---

## Drift Protection Checklist

Before merging ANY job system changes:

- [ ] Run `npm run verify:zero-drift` - must pass
- [ ] New smoke tests import from `_http.mjs` and `_skip.mjs`
- [ ] No new `x-user-id` headers hardcoded
- [ ] No new `must()` or `sleep()` implementations
- [ ] Skip logic uses `skipIfMemoryMode()` only
- [ ] CI passes in memory mode (State 1)
- [ ] `ALLOW_HEADER_USER_ID` never set in production env

---

## Future Maintenance (Single Change Points)

### To Change Auth Header
**Edit ONE file**: `scripts/_http.mjs:authHeaders()`
- Change propagates to all 4 smoke tests automatically
- Zero script edits required

### To Change Skip Message Format
**Edit ONE file**: `scripts/_skip.mjs:skipTest()`
- Change propagates to all 4 smoke tests automatically
- Consistent CI logs guaranteed

### To Change Auth Gate Logic
**Edit ONE file**: `lib/jobs/rateLimiter.ts:checkFeatureAccess()`
- Change affects all API endpoints automatically
- Production fail-safe always active

---

## Verification Commands (Run Anytime)

```bash
# Quick verification
npm run verify:zero-drift

# Full evidence collection
git rev-parse HEAD
git show -s --format=fuller HEAD
rg "from \"\\.\\/(_http|_skip)" scripts
rg "x-user-id" scripts/*.mjs
rg -n "^function must|^function sleep" scripts/jobs-*.mjs
gh run list --repo Mmeraw/literary-ai-partner --workflow="Job System CI" --limit 3
```

---

## Commit History (Audit Trail)

```bash
$ git log --oneline -n 10 -- scripts/_http.mjs scripts/_skip.mjs lib/jobs/rateLimiter.ts lib/jobs/config.ts
```

**Key Commits**:
- Production fail-safe assert added
- Drift tripwire CI check added  
- All 4 smoke tests refactored to use helpers
- Zero-drift verification doc created

---

## Solo Operator Guarantee

✅ **One change point for auth** → Edit `_http.mjs`, affects 4 tests  
✅ **One change point for skips** → Edit `_skip.mjs`, affects 4 tests  
✅ **Production can't start if misconfigured** → Startup assert throws  
✅ **CI fails if drift reappears** → Tripwire catches regressions  

**Result**: Maintainable by one person forever. No drift possible.
