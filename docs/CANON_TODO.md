# CANON TODO Checklist

Quick reference for remaining canonicalization work.

## ✅ DONE: Schema Drift Eliminated

Progress counters now 100% consistent:
- `total_units` / `completed_units` everywhere
- No more `units_total` / `units_completed` drift
- See: [docs/CANON_SCHEMA_FIXES.md](./CANON_SCHEMA_FIXES.md)

## ✅ DONE: PhaseStatus Vocabulary LOCKED

Phase status vocabulary now CANON-aligned:
- `PhaseStatus = JobStatus | null`
- All writers emit: `"queued" | "running" | "complete" | "failed"`
- DB guard prevents test strings from leaking to Supabase
- UI helper `toUiText()` for type-safe rendering
- See: [docs/CANON_PHASE_STATUS_LOCKED.md](./CANON_PHASE_STATUS_LOCKED.md)

---

## 📋 TODO: 3 Remaining Items (All Non-Blocking)

### 🟡 MEDIUM PRIORITY

#### 1. Fix JobPhaseDetail Nullability
**Issue**: `phase_status` is typed as non-null but assigned `null`

**Current (UNSAFE)**:
```typescript
export type JobPhaseDetail = {
  phase: Phase | null;
  phase_status: PhaseStatus;  // ❌ Can't be null!
  display: string;
};
```

**Fix (SAFE)**:
```typescript
export type JobPhaseDetail = {
  phase: Phase | null;
  phase_status: PhaseStatus | null;  // ✅ Matches reality
  display: string;
};
```

**File**: [lib/jobs/ui-helpers.ts](../lib/jobs/ui-helpers.ts#L15-L19)

**Test**:
```typescript
const detail: JobPhaseDetail = {
  phase: null,
  phase_status: null,  // Should not error with strictNullChecks
  display: "Not started"
};
```

---

### 🟢 LOW PRIORITY

#### 2. Test Script Endpoint Consistency
**Issue**: Mixing `/api/internal/jobs` and `/api/jobs` endpoints in tests

**Current**:
```bash
# scripts/test-phase2-vertical-slice.sh
JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/api/internal/jobs" ...)
ARTIFACT_JSON=$(curl -s "$BASE_URL/api/jobs/$JOB_ID/artifacts" ...)
```

**Fix**: Choose one auth model per script

**Option A: All internal** (recommended)
```bash
ARTIFACT_JSON=$(curl -s "$BASE_URL/api/internal/jobs/$JOB_ID/artifacts" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
```

**Option B: Public artifacts** (if intentionally unauthenticated)
```bash
# Remove bearer token, document why public
ARTIFACT_JSON=$(curl -s "$BASE_URL/api/jobs/$JOB_ID/artifacts")
```

**File**: [scripts/test-phase2-vertical-slice.sh](../scripts/test-phase2-vertical-slice.sh#L163)

---

#### 3. Silence Dotenv Output in Scripts
**Issue**: Dotenv logs pollute script output, breaking parsers

**Current**:
```bash
SUPABASE_URL=$(node -e "require('dotenv').config({path:'.env.local'}); ...")
# Output: [dotenv@17.2.3] injecting env (5) from .env.local...
```

**Fix Option A: Environment variable**
```bash
DOTENV_CONFIG_QUIET=true node -e "require('dotenv').config({path:'.env.local'}); ..."
```

**Fix Option B: Disable debug in code**
```bash
node -e "require('dotenv').config({path:'.env.local', debug: false}); ..."
```

**Fix Option C: Filter stderr**
```bash
SUPABASE_URL=$(node ... 2>&1 | grep -v "dotenv" | tail -1)
```

**Files**:
- [scripts/verify-supabase-project.sh](../scripts/verify-supabase-project.sh#L18)
- Any other scripts that parse Node output

---

## 🎯 Acceptance Criteria

### Item 1: PhaseStatus Vocabulary
- [ ] Decision documented in types.ts
- [ ] All phase writers emit only chosen values
- [ ] UI helpers handle only chosen values
- [ ] Validation checks only chosen values
- [ ] Tests pass with new vocabulary

### Item 2: Nullability Fix
- [ ] `JobPhaseDetail.phase_status` typed as `PhaseStatus | null`
- [ ] All consumers handle null case
- [ ] TypeScript compiles with `strictNullChecks` enabled
- [ ] No runtime null errors

### Item 3: Endpoint Consistency
- [ ] Test script uses one auth model per endpoint
- [ ] Decision documented (internal vs public)
- [ ] All endpoints in script match chosen model
- [ ] Tests pass with consistent auth

### Item 4: Dotenv Silence
- [ ] No dotenv logs in script stdout
- [ ] Parsers work reliably
- [ ] Verification scripts run clean

---

## 📊 Priority Matrix

| Item | Risk | Effort | Impact | Priority |
|------|------|--------|--------|----------|
| PhaseStatus vocabulary | HIGH | MEDIUM | HIGH | 🔴 HIGH |
| Nullability fix | HIGH | LOW | MEDIUM | 🔴 HIGH |
| Endpoint consistency | LOW | LOW | LOW | 🟡 MEDIUM |
| Dotenv silence | LOW | LOW | LOW | 🟢 LOW |

---

## 🚀 Next Steps

1. **Decide**: Choose PhaseStatus vocabulary (Item 1)
2. **Apply**: Update types.ts with decision
3. **Cascade**: Update all consumers (phase writers, UI, validation)
4. **Fix**: Make JobPhaseDetail.phase_status nullable (Item 2)
5. **Polish**: Clean up test scripts (Items 3-4)

---

Last Updated: January 27, 2026  
See Also: [CANON_SCHEMA_FIXES.md](./CANON_SCHEMA_FIXES.md)
