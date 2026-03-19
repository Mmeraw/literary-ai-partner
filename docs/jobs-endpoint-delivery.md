# Job Status Endpoint Implementation — Historical Checkpoint

**Status:** ✅ Historical milestone (superseded by newer work on this branch)

> This document captures the endpoint/poller delivery checkpoint.
> It is intentionally preserved as a milestone note, not the final branch status.

---

## Checkpoint Snapshot (What Was Delivered Then)

### 1. Canonical Job Status Endpoint
**File:** [app/api/jobs/[jobId]/route.ts](app/api/jobs/[jobId]/route.ts)

**Contract (per JOBCONTRACT_v1):**
- **Method:** `GET /api/jobs/:jobId`
- **Auth:** `x-user-id` header (dev/test) or Supabase session (prod)
- **Ownership:** 404 for both not-found and not-owned (no permission leakage)

**Response Shape (Success):**
```json
{
  "ok": true,
  "job": {
    "id": "uuid",
    "status": "queued|running|complete|failed",
    "progress": 0-100,
    "created_at": "2026-03-19T12:00:00Z",
    "updated_at": "2026-03-19T12:35:00Z",
    "last_error": "..."  // only on status=failed
  }
}
```

**Status Codes:**
- `200` — Job found, owned, and readable
- `401` — Missing or invalid authentication
- `404` — Job not found or not owned
- `500` — Invalid state in database

---

### 2. Comprehensive Test Suite (at checkpoint time)
**File:** [tests/api/jobs-endpoint.test.ts](tests/api/jobs-endpoint.test.ts)

**Coverage (16 Tests, All Passing at the time):**

| Category | Tests | Details |
|----------|-------|---------|
| **Auth** | 1 | Missing `x-user-id` header → 401 |
| **Not Found** | 1 | Non-existent job → 404 |
| **Ownership** | 1 | Non-owner user → 404 (no leak) |
| **Success Cases** | 3 | Status values: queued, running, complete |
| **Error Handling** | 3 | Failed state + last_error field rules |
| **Progress Calc** | 4 | Edge cases: 0 units, null progress, rounding |
| **Status Validation** | 1 | Invalid DB state → 500 |
| **Envelope** | 2 | Response shape always has `ok` + `job/error` |

**Test Run:**
```
Test Suites: 1 passed
Tests:       16 passed, 16 total
Time:        0.238s
```

---

### 3. Real-Time Polling UI Component
**File:** [components/EvaluationPoller.tsx](components/EvaluationPoller.tsx)

**Features:**
- Polls `GET /api/jobs/[jobId]` every 1.5s by default
- Automatic stop on terminal states (complete, failed)
- Visual progress bar (0-100%)
- Error display (failed state only)
- Callback on completion
- Development mode metadata
- Tailwind CSS styling

**Usage:**
```tsx
<EvaluationPoller
  jobId={jobId}
  userId={userId}  // optional, for dev
  onComplete={(job, isSuccess) => { ... }}
  refreshInterval={1500}  // ms
/>
```

**Renders:**
- Status label + color coding
- Progress bar (while running)
- Timestamps (created, updated)
- Error message (on failure)

---

## Why This Checkpoint Mattered

**Before (No Endpoint):**
- Jobs are opaque: can't see status, progress, or failures
- Debugging impossible: "Is it running? Did it fail?"
- No user feedback: UI can't show anything

**After (Job Endpoint checkpoint):**
- ✅ Clear, observable job state
- ✅ Progress visible (0-100%)
- ✅ Failures surface with human-readable description
- ✅ Polling UI provides real-time user experience
- ✅ Established foundation for Phase 2.4 (failure classification)

---

## Contract & Governance

| Document | Alignment | Notes |
|----------|-----------|-------|
| **JOBCONTRACT_v1** | ✅ Full | Status enum locked: `queued\|running\|complete\|failed` |
| **AI_GOVERNANCE** | ✅ Full | No status values beyond canonical set |
| **Ownership Enforcement** | ✅ Full | RLS + API-layer verification |
| **Error Response** | ✅ Full | Structured `{ ok, error }` or `{ ok, job }` |

---

## Current Branch Status (Updated)

- ✅ Job endpoint complete
- ✅ Polling UI complete and hardened
  - adaptive backoff
  - transient retry UX
  - terminal stop logic
  - complete-state redirect + CTA/countdown
- ✅ Jobs endpoint tests green (expanded beyond original snapshot)
- ✅ Failure classification 2.4.a complete (`lib/errors/revisionCodes.ts`, `docs/errors/failure-codes.md`)
- ✅ Failure classification 2.4.b complete for current jobs/apply path (`failure_envelope`/`failure_code` write + read surfacing)
- ✅ Failure classification 2.4.c complete for covered apply failure modes (`tests/failures/apply-failure-classification-paths.test.ts`)

### 2.4.c concrete proof (apply-path)

- Table-driven failure-path cases now validated for:
  - `ANCHOR_MISS`
  - `ANCHOR_AMBIGUOUS`
  - `CONTEXT_MISMATCH`
  - `OFFSET_CONFLICT`
  - `PARSE_ERROR`
  - `INVARIANT_VIOLATION`
  - `APPLY_COLLISION`
- Assertions verify, per case:
  - expected `failure_code`
  - non-empty persisted `failure_envelope.context`
  - non-empty `last_error`
  - jobs path read surfaces classified `failure_code`
  - no `UNKNOWN` / generic fallback in covered paths

---

## Verified Data/Ownership Note

- `evaluation_jobs` does **not** have a direct `user_id` column in the canonical table definition.
- Ownership is enforced via manuscript linkage (`evaluation_jobs.manuscript_id -> manuscripts`) and ownership checks.
- In the app jobs path, owner identity is resolved from session (or dev header in gated test mode) and compared against resolved job ownership.

This note is verified against current code/schema and replaces older assumptions.

---

## Updated Files Likely in This Change Set

- `app/api/jobs/[jobId]/route.ts`
- `components/EvaluationPoller.tsx`
- `app/evaluate/[jobId]/page.tsx`
- `tests/api/jobs-endpoint.test.ts`
- `lib/errors/revisionCodes.ts`
- `docs/errors/failure-codes.md`
- `lib/jobs/jobStore.supabase.ts`
- `lib/jobs/types.ts`
- `lib/db/schema.ts`
- `tests/failures/apply-failure-codes.test.ts`

---

**Delivered By:** Copilot  
**Date:** 2026-03-19  
**Status:** ✅ Historical checkpoint retained; see “Current Branch Status (Updated)” above for live state
