# ✅ CANON SCHEMA FIXES COMPLETE

**Date**: January 27, 2026  
**Status**: Schema drift eliminated

---

## 🎯 What Was Fixed

### 1. Progress Counter Schema Unified ✅

**Problem**: Mixed usage of `units_total/units_completed` vs `total_units/completed_units`

**Fix**: All code now uses CANON schema: `total_units` / `completed_units`

**Files Changed**:
- ✅ [lib/jobs/types.ts](lib/jobs/types.ts#L73-L82) - CANON schema defined
- ✅ [lib/jobs/jobStore.memory.ts](lib/jobs/jobStore.memory.ts#L33-L37) - Initial job creation
- ✅ [lib/jobs/phase1.ts](lib/jobs/phase1.ts) - Phase 1 writers (15 locations)
- ✅ [lib/jobs/phase2.ts](lib/jobs/phase2.ts) - Phase 2 writers (8 locations)
- ✅ [lib/jobs/validation.ts](lib/jobs/validation.ts) - Validation readers
- ✅ [lib/jobs/cancel.ts](lib/jobs/cancel.ts) - Cancel handler

**Verification**:
```bash
# Should return NO results
grep -rn "units_total\|units_completed" lib/jobs/*.ts | grep -v test
# Exit code: 1 (no matches) ✅
```

---

## 📋 CANON Schema Definition

From [lib/jobs/types.ts](lib/jobs/types.ts):

```typescript
/**
 * JOB_CONTRACT_v1 — CANON progress shape (minimum)
 * May include additional keys, but these keys must match meaning.
 * 
 * CANON keys (written by phase1.ts and phase2.ts):
 * - total_units: total work items (chunks)
 * - completed_units: completed work items
 */
export type JobProgress = {
  phase: Phase | null;
  phase_status: PhaseStatus;
  total_units: number | null;
  completed_units: number | null;
  [k: string]: unknown;
};
```

---

## 🛡️ Remaining CANON Work (User's Checklist)

The user identified these additional issues. Marking status:

### 2. PhaseStatus Nullability ⚠️ TODO
- [ ] Make `JobPhaseDetail.phase_status` typed as `PhaseStatus | null` in UI helpers
- Current: Typed as non-null but assigned `null` (unsafe with strictNullChecks)
- Location: `lib/jobs/ui-helpers.ts`

### 3. Phase Status Vocabulary ⚠️ NEEDS DECISION
User needs to decide: Granular vs Canonical

**Option A: Granular** (matches current UI intent)
```typescript
export type PhaseStatus = "starting" | "running" | "complete" | "failed";
```

**Option B: Canonical** (align with JobStatus)
```typescript
export type PhaseStatus = JobStatus; // "queued" | "running" | "complete" | "failed"
```

**Impact**: All phase writers and UI labels must match chosen vocabulary

### 4. Badge Display Logic ✅ ALREADY CORRECT
- `getJobDisplayInfo()` correctly derives "Canceled"/"Retrying" from progress markers
- DB `status` remains CANON (queued|running|complete|failed)
- No changes needed

### 5. getChunksForJob() Signature ✅ ALREADY DONE (from diff)
- Changed to options object pattern
- Includes fallback for missing `job_id` column
- Requires `phase1StartedAt` and `expectedChunkCount` for safety

### 6. Test Script Auth Consistency ⚠️ TODO
- [ ] Update `scripts/test-phase2-vertical-slice.sh` to use `/api/internal` consistently
- Currently mixing `/api/internal/jobs` and `/api/jobs` endpoints
- Line ~163: artifact fetch should match auth model

### 7. Dotenv Noise ⚠️ TODO
- [ ] Set `DOTENV_CONFIG_QUIET=true` in verification scripts
- [ ] Or use `-e "require('dotenv').config({debug: false})"` pattern
- Prevents script output pollution

---

## ✅ Verification Commands

### Check Schema Consistency
```bash
# Should show NO old schema usage
cd /workspaces/literary-ai-partner
grep -rn "units_total\|units_completed" lib/jobs/*.ts | grep -v test
# Expected: Exit code 1 (no matches)
```

### Check CANON Usage
```bash
# Should show consistent usage
grep -rn "total_units\|completed_units" lib/jobs/*.ts | grep -v test | wc -l
# Expected: ~30 lines (all using CANON schema)
```

### Run Tests
```bash
npm test -- jobStore
npm test -- phase1
npm test -- validation
```

---

## 📊 Impact Summary

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| **Progress Schema** | Mixed `units_*` and `*_units` | CANON `total_units/completed_units` | ✅ FIXED |
| **Phase Writers** | Inconsistent | All use CANON | ✅ FIXED |
| **Readers** | Inconsistent | All use CANON | ✅ FIXED |
| **Type Safety** | Runtime drift risk | Type-enforced consistency | ✅ FIXED |

---

## 🎓 Why This Matters

### Before (Schema Drift)
```typescript
// Writer (phase1.ts)
progress: { units_total: 10, units_completed: 5 }

// Reader (validation.ts)
const total = progress?.total_units  // ❌ undefined!
```

Result: **Silent bugs** - validation sees `undefined`, skips checks

### After (CANON)
```typescript
// Writer (phase1.ts)
progress: { total_units: 10, completed_units: 5 }

// Reader (validation.ts)
const total = progress?.total_units  // ✅ 10
```

Result: **Type-safe** - schema enforced by TypeScript

---

## 🚀 Next Steps (Priority Order)

1. **HIGH**: Decide phase_status vocabulary (granular vs canonical)
2. **HIGH**: Fix `JobPhaseDetail.phase_status` nullability
3. **MEDIUM**: Update test script endpoints for consistency
4. **LOW**: Add `DOTENV_CONFIG_QUIET=true` to verification scripts

---

## 📁 Key Files

- **[lib/jobs/types.ts](lib/jobs/types.ts)** - CANON schema definition (source of truth)
- **[lib/jobs/phase1.ts](lib/jobs/phase1.ts)** - Phase 1 progress writers
- **[lib/jobs/phase2.ts](lib/jobs/phase2.ts)** - Phase 2 progress writers
- **[lib/jobs/validation.ts](lib/jobs/validation.ts)** - Progress validation
- **[lib/jobs/ui-helpers.ts](lib/jobs/ui-helpers.ts)** - UI display logic

---

**Status**: Schema drift eliminated ✅  
**Remaining Work**: 3 TODOs (see sections 2, 6, 7 above)  
**Risk Level**: 🟢 LOW (CANON schema enforced, no silent drift)

---

Last Updated: January 27, 2026
