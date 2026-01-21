# Day-1 UI Contract Compliance Checklist

This document verifies that the Day-1 Evaluation UI implementation (Tracks A, B, C) fully complies with [UI_CONTRACT.md](UI_CONTRACT.md).

## API Endpoints ✅

✅ **POST /api/jobs** - Used by [ManuscriptSubmissionForm.jsx](../../components/evaluation/ManuscriptSubmissionForm.jsx)
- Sends `manuscript_id` and `job_type: "evaluate_full"`
- Receives `job_id` and `status`

✅ **GET /api/jobs** - Used by [useJobs.tsx](../../lib/jobs/useJobs.tsx)
- Polls every 2 seconds
- Receives `{ jobs: Job[] }`

## Canonical Fields ✅

The UI reads ONLY these fields from the Job object:

✅ **Identity & timestamps**: `id`, `job_type`, `created_at`, `updated_at`
✅ **Status**: `status` (queued/running/retry_pending/failed/complete/canceled)
✅ **Phase**: `phase`, `phase_status`
✅ **Progress**: `total_units`, `completed_units`, `failed_units`
✅ **Error**: `last_error` (optional)
✅ **Progress snapshot**: `progress` (treated as opaque via `getJobDisplayInfo`)

**Implementation**: All field reads go through [lib/jobs/ui-helpers.ts](../../lib/jobs/ui-helpers.ts) `getJobDisplayInfo()` helper.

## Terminal State Semantics ✅

✅ **Terminal detection**: [lib/ui/phase-helpers.ts](../../lib/ui/phase-helpers.ts) `isTerminalStatus()`
- Returns `true` for: `complete`, `failed`, `canceled`

✅ **Freeze UI in final state**: [EvaluateEntry.jsx](../../components/evaluation/EvaluateEntry.jsx)
- Renders final status badge
- Shows appropriate completion/failure banner
- No running indicators

✅ **Stop polling**: [useJobs.tsx](../../lib/jobs/useJobs.tsx) `allJobsTerminal()`
- Clears interval when all jobs terminal
- No more API calls after terminal state

## Rendering Rules ✅

### Ordering ✅
✅ Jobs sorted by `created_at DESC` in [EvaluateEntry.jsx](../../components/evaluation/EvaluateEntry.jsx)

### Empty State ✅
✅ Message: "No evaluations yet"
✅ CTA: "Submit your manuscript above to run your first evaluation"

### Status Badge Mapping ✅
✅ All six states mapped in [ui-helpers.ts](../../lib/jobs/ui-helpers.ts) `getJobStatusBadge()`:
- queued → Queued (gray)
- running → Running (blue)
- retry_pending → Retry Pending (yellow)
- complete → Complete (green)
- failed → Failed (red)
- canceled → Canceled (gray)

✅ **No invented states**

### Queued Trust Screen ✅
✅ Message: "Preparing evaluation…"
✅ Sub-message: "This usually takes ~2–3 minutes"
✅ Clock icon displayed
✅ Progress bar only shown if `total_units > 0`

### Running Trust Screen ✅
✅ Progress: `completed_units / total_units` (only if `total_units > 0`)
✅ Relative time: via [time-helpers.ts](../../lib/ui/time-helpers.ts) `formatRelativeTime()`
✅ Elapsed duration: via `formatDuration()`
✅ Progress bar with percentage

### Phase-Specific Copy ✅
✅ Implemented in [phase-helpers.ts](../../lib/ui/phase-helpers.ts) `getPhaseSpecificCopy()`:
- Phase 1: "Analyzing structure and craft…" + description
- Phase 2: "Generating revision guidance…" + description
- Null/unknown: Falls back to generic "Processing…"

✅ **No guessing** - explicit fallback handling

### Completion State ✅
✅ Success banner: [CompletionBanner.jsx](../../components/evaluation/CompletionBanner.jsx)
- Title: "Evaluation Complete!"
- Supporting text: "Your manuscript has been analyzed..."
- Prominent CTA: "View Evaluation Report" (large green button)

✅ Polling stopped
✅ No running indicators

### Failure State ✅
✅ Failure message displayed
✅ `last_error` shown in sub-message (if present)
✅ Polling stopped
✅ No completion CTA

### Canceled State ✅
✅ Canceled badge displayed
✅ Polling stopped
✅ No completion CTA

## Polling Rules ✅

✅ **Polls every 2 seconds** while jobs are non-terminal
✅ **Stops immediately** when all jobs reach terminal state
✅ **No indefinite polling** after terminal status
✅ Implemented in [useJobs.tsx](../../lib/jobs/useJobs.tsx) with `allJobsTerminal()` check

## UI Assumptions / Invariants ✅

### Assumptions the UI makes ✅
✅ `completed_units <= total_units` (handled safely)
✅ Terminal states don't regress (polling stops)
✅ `status === "complete"` is permanent (frozen state)

### Assumptions the UI does NOT make ✅
✅ Does NOT assume `phase` is always present (null checks in place)
✅ Does NOT depend on nested `progress` fields (uses `getJobDisplayInfo()`)
✅ Does NOT assume `total_units > 0` (safe handling with conditional rendering)

## Test Coverage ✅

✅ **19 passing tests** in [day1-evaluation-ui.test.ts](../../tests/day1-evaluation-ui.test.ts)
- Track A: Job creation and listing ✅
- Track B: Trust screens and formatting ✅
- Track C: Completion experience and polling ✅
- Contract compliance validation ✅

## Contract Change Policy ✅

✅ **Locked fields**: Implementation uses ONLY fields defined in UI_CONTRACT.md
✅ **Central helpers**: All field access through `getJobDisplayInfo()` and `getJobStatusBadge()`
✅ **Test coverage**: Changes to contract will break tests, ensuring visibility

---

## Summary

**Status**: ✅ **FULLY COMPLIANT**

The Day-1 Evaluation UI (Tracks A, B, C) adheres to all requirements in UI_CONTRACT.md:
- Uses only approved API endpoints
- Reads only canonical fields
- Implements terminal state semantics correctly
- Follows all rendering rules
- Respects polling rules
- Makes safe assumptions only
- Has comprehensive test coverage

**No contract violations detected.**
