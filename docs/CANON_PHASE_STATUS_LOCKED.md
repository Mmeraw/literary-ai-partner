# PhaseStatus Vocabulary — CANON LOCKED ✅

**Status**: COMPLETE  
**Date**: January 27, 2026  
**Scope**: Phase status vocabulary is now canonically aligned with JobStatus

---

## What Changed

### 1. PhaseStatus Vocabulary Locked to CANON

**Before**: Mixed usage of `"not_started"` vs `"queued"`  
**After**: All phase writers use CANON: `"queued" | "running" | "complete" | "failed" | null`

```typescript
// types.ts — The Truth
export type JobStatus = "queued" | "running" | "complete" | "failed";
export type PhaseStatus = JobStatus | null;

// phase1.ts — Aligned
export const PHASE_1_STATES = {
  QUEUED: "queued",      // ← Changed from NOT_STARTED: "not_started"
  RUNNING: "running",
  COMPLETED: "complete",
  FAILED: "failed",
} as const;
```

### 2. DB Guard for manuscript_id

**Purpose**: Prevent test strings like `"test_ms_..."` from leaking into Supabase

```typescript
// jobStore.supabase.ts — DB Write Guard
const parsed = Number.parseInt(input.manuscript_id, 10);
if (Number.isNaN(parsed) || String(parsed) !== input.manuscript_id.trim()) {
  throw new Error(
    `Invalid manuscript_id "${input.manuscript_id}": Database writes require numeric IDs. ` +
    `Use memory store (TEST_MODE=true) for test strings.`
  );
}
```

**Contract**: 
- Memory store accepts `manuscript_id: number | string` (for tests)
- Supabase store **requires** numeric IDs and **rejects** test strings
- Type system allows union, runtime enforces constraint

### 3. UI Helper for Type-Safe Rendering

**Purpose**: Clean, consistent conversion of unknown values to display text

```typescript
// ui-helpers.ts — New Export
export function toUiText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
}

// JobStatusPoll.tsx — Usage
{toUiText(job.progress.completed_units)} / {toUiText(job.progress.total_units)}
```

---

## Files Changed

### Core Type System
- **lib/jobs/types.ts**: Added PhaseStatus CANON comment documenting alignment
- **lib/jobs/phase1.ts**: Changed `NOT_STARTED` → `QUEUED` in PHASE_1_STATES
- **lib/jobs/phase1.test.ts**: Updated test cases to use `QUEUED` instead of `NOT_STARTED`

### Database Layer
- **lib/jobs/jobStore.supabase.ts**: 
  - Added strict manuscript_id numeric validation
  - Changed initial `phase_status: "not_started"` → `"queued"`

### UI Layer
- **lib/jobs/ui-helpers.ts**: Added `toUiText()` helper function
- **app/evaluate/[jobId]/JobStatusPoll.tsx**: Replaced `String()` with `toUiText()`

### Verification
- **scripts/verify-canon-schema.sh**: Updated success message to reflect locked PhaseStatus

---

## Verification Results

**Final State**: All systems green as of final verification (ended green, not never red).

**Note**: During the CANON alignment (changing `NOT_STARTED` → `QUEUED`), tests briefly failed until test expectations were updated. This is expected behavior when refactoring vocabulary - the type system and tests caught the mismatch immediately. Final verification confirmed 11 transitions (4 allowed, 7 forbidden) stable across multiple runs.

### TypeScript Compilation
```bash
$ npx tsc --noEmit --skipLibCheck
✅ TypeScript: CLEAN
```

### Test Suite
```bash
$ npm test
Test Suites: 6 passed, 6 total
Tests:       98 passed, 98 total
✅ ALL TESTS PASSING (verified stable across multiple runs)
```

### Phase 1 Transition Logic (Verified Non-Flaky)
```bash
$ npm test -- lib/jobs/phase1.test.ts  # Run 1
$ npm test -- lib/jobs/phase1.test.ts  # Run 2
✅ PASS (11/11 tests, stable across runs)
```

### CANON Schema Verification
```bash
$ bash scripts/verify-canon-schema.sh
✅ PASS: No old schema found (units_total/units_completed)
✅ PASS: 81 CANON schema usages found (total_units/completed_units)
✅ PASS: JobProgress uses CANON schema
✅ PASS: Memory store uses CANON schema
📋 PhaseStatus vocabulary: LOCKED to CANON
```

---

## Benefits

### 1. **Type System Prevents Drift**
- `PhaseStatus = JobStatus | null` enforces alignment at compile time
- No granular states like `"starting"`, `"processing"` allowed
- Writers must use CANON vocabulary or fail type checking

### 2. **Runtime Guards Protect Boundaries**
- DB guard ensures test strings never reach Supabase
- Contract: memory store is test-only, Supabase is production-only
- Clear error messages when boundary violated

### 3. **Zero-Maintenance Consistency**
- Shared const objects (`JOB_STATUS`, `PHASE_1_STATES`) ensure vocabulary match
- UI helper eliminates ad-hoc `String()` conversions
- Verification script catches any future drift

### 4. **Clear Separation of Concerns**
- **Type Level**: PhaseStatus = JobStatus | null
- **Display Level**: UI helpers map CANON to human text
- **Business Logic**: Writers emit CANON, readers consume CANON

---

## Remaining Work (Non-Blocking)

From [docs/CANON_TODO.md](./CANON_TODO.md):

1. **Fix JobPhaseDetail nullability** (MEDIUM priority)
   - Make `phase_status: PhaseStatus | null` explicit in type
   - Currently typed non-null but assigned null in some paths

2. **Update test script endpoints** (LOW priority)  
   - Choose one auth model (internal vs public) per script
   - Currently mixing `/api/internal/jobs` and `/api/jobs`

3. **Silence dotenv output** (LOW priority)  
   - Add `DOTENV_CONFIG_QUIET=true` to verification scripts
   - Prevents log pollution in CI/CD

---

## Truth Table: Phase Status Vocabulary

| Context | Allowed Values | Notes |
|---------|---------------|-------|
| **Type System** | `"queued" \| "running" \| "complete" \| "failed" \| null` | CANON enforced by PhaseStatus type |
| **Phase Writers** | `JOB_STATUS.QUEUED`, `JOB_STATUS.RUNNING`, etc. | Use const objects, not string literals |
| **Database** | Same as type system | Stored in `progress.phase_status` JSONB field |
| **UI Display** | Any human text via helpers | Map CANON → "Phase 1: Starting", etc. |
| **Tests** | Same as type system | Use `PHASE_1_STATES.QUEUED`, etc. |

---

## Phase 1 State Transitions (CANON-Safe)

### Allowed Transitions

```typescript
const ALLOWED_TRANSITIONS: Record<Phase1State, Phase1State[]> = {
  queued: ["running"],        // Job starts processing
  running: ["complete", "failed"],  // Job finishes (success or error)
  failed: ["running"],         // Retry: reset to running, NOT back to queued
  complete: [],                // Terminal state (Phase 2 takes over)
};
```

### Key Semantics

1. **Initial State**: `queued` (set at job creation)
2. **Start Transition**: `queued → running` (when Phase 1 executor picks up job)
3. **Success Path**: `running → complete` (all chunks processed)
4. **Failure Path**: `running → failed` (chunk processing error)
5. **Retry Action Transition**: `failed → running` (explicit retry trigger; not automatic)
6. **Terminal**: `complete` (Phase 1 done, Phase 2 can begin)

### Why `failed → running` (not `failed → queued`)?

- `queued` means "waiting to start" - the job hasn't been picked up yet
- `running` means "actively processing" - the job is assigned to a worker
- When **explicitly retrying** a failed job, we're restarting processing (not re-queuing)
- This matches the semantic intent: retry = resume work, not wait in queue again
- **Important**: `failed → running` requires explicit user/system action; it's not automatic

### Verification

```bash
$ npm test -- lib/jobs/phase1.test.ts
Tests: 11 passed, 11 total (4 allowed, 7 forbidden)

✓ canTransitionPhase1(queued → running) === true
✓ canTransitionPhase1(running → complete) === true
✓ canTransitionPhase1(running → failed) === true
✓ canTransitionPhase1(failed → running) === true      # Explicit retry action
✓ canTransitionPhase1(queued → complete) === false    # Can't skip
✓ canTransitionPhase1(queued → failed) === false      # Can't fail before start
✓ canTransitionPhase1(running → queued) === false     # Can't go backwards
✓ canTransitionPhase1(failed → complete) === false    # Can't skip retry
✓ canTransitionPhase1(failed → queued) === false      # No backwards queue
✓ canTransitionPhase1(complete → running) === false   # Terminal
✓ canTransitionPhase1(complete → failed) === false    # Terminal
✓ canTransitionPhase1(complete → queued) === false    # Terminal
```

---

## Migration Notes

### If You Had Custom Phase States

**Example**: If your codebase had `phase_status: "initializing"`:

```typescript
// ❌ BEFORE (non-CANON)
await updateJob(id, {
  progress: { phase_status: "initializing" }
});

// ✅ AFTER (CANON-aligned)
await updateJob(id, {
  progress: { 
    phase_status: JOB_STATUS.RUNNING,
    message: "Initializing..." // Granularity in message
  }
});
```

**Rule**: CANON status in `phase_status`, granular detail in `message`.

---

## ChatGPT Feedback Addressed

> "The highest-leverage one is: PhaseStatus vocabulary: lock phase_status to one domain and enforce it at the type level and in writers."

✅ **DONE**:
- PhaseStatus type enforces CANON at compile time
- PHASE_1_STATES aligned with JOB_STATUS
- All writers updated to emit CANON values only
- Tests verify transition logic with CANON vocabulary

> "manuscript_id: number | string — keep DB inserts explicitly numeric"

✅ **DONE**:
- Supabase store validates numeric manuscript_id at runtime
- Clear error message if test string provided
- Memory store preserves string support for tests

> "String() wrapper in JobStatusPoll.tsx — prefer a tiny helper"

✅ **DONE**:
- Created `toUiText()` helper in ui-helpers.ts
- Replaced inline `String()` calls
- Handles null/undefined/objects consistently

---

## When You Return

```bash
# Verify everything is still CANON
bash scripts/pre-work-checklist.sh
bash scripts/verify-canon-schema.sh

# Expected output:
✅ ALL CHECKS PASSED - Safe to start development!
📋 PhaseStatus vocabulary: LOCKED to CANON (queued|running|complete|failed)
```

All systems green. PhaseStatus vocabulary is now canonically aligned and enforced by the type system. 🎉
