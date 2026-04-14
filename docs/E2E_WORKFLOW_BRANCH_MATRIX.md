# E2E Workflow Branch Matrix (Evaluate → Report)

> ✅ **Canonical flow clarification (2026-04):**
> The `run-phase2` endpoint name is retained for compatibility, but execution authority is canonical:
> route entrypoint -> `lib/evaluation/processor.ts` -> `runPipeline()` -> canonical artifact persistence.
>
> Legacy executors (`workers/phase2Worker.ts`, `workers/phase2Evaluation.ts`, `lib/jobs/phase2.ts`) are quarantine-only and not normal production flow.

This document defines the end-to-end workflow process and branch outcomes for Flow 1.

## Primary Flow

1. **Create Job**: `POST /api/jobs`
2. **Poll Status**: `GET /api/jobs` and `GET /api/jobs/[jobId]`
3. **Run Phase 1**: `POST /api/jobs/[jobId]/run-phase1` (internal service role)
4. **Run Canonical Evaluation** (compat endpoint name: `run-phase2`): `POST /api/jobs/[jobId]/run-phase2` (internal service role)
5. **Read Evaluation**: `GET /api/evaluations/[jobId]`
6. **Read Artifact (debug/user endpoint)**: `GET /api/jobs/[jobId]/artifacts`

## Branch Matrix

### 1) Job Creation (`POST /api/jobs`)

- **201**: Job created (canonical success)
- **400**: Invalid JSON, invalid `job_type`, invalid `manuscript_id`, missing required fields
- **401**: Auth missing
- **403**: Feature access denied
- **413**: Manuscript too large
- **429**: Rate-limited
- **503**: Backpressure blocked
- **500**: Internal create failure (DB/system/runtime)

### 2) Job Detail (`GET /api/jobs/[jobId]`)

- **200**: Owner receives canonical job payload
- **400**: Missing/blank `jobId`
- **401**: Unauthorized (no valid actor)
- **404**: Job missing OR non-owner (anti-enumeration)

### 3) Job List (`GET /api/jobs`)

- **200**: User-scoped job list with limit clamp
- **401**: Auth missing
- **200 (dev/test only)**: Header actor path when `ALLOW_HEADER_USER_ID=true`, `NODE_ENV!=production`, and optional `x-dev-auth` token matches `DEV_HEADER_AUTH_TOKEN`
- **500**: Query/runtime failure

### 4) Evaluation Report API (`GET /api/evaluations/[jobId]`)

- **200**: Completed job + artifact found (`source: "artifact"`)
- **401**: Unauthorized
- **403**: Ownership mismatch
- **404**: Job missing OR artifact missing for completed job
- **409**: Job not complete yet
- **500**: Query/runtime failure

### 5) Artifact API (`GET /api/jobs/[jobId]/artifacts`)

- **200**: Returns canonical `one_page_summary` artifact or `artifact: null`
- **400**: Missing/blank `jobId`
- **401**: Unauthorized
- **403**: Ownership mismatch
- **404**: Job not found
- **500**: Query/runtime failure

## Operational Guards

- Canonical status values only: `queued`, `running`, `complete`, `failed`
- Ownership derived from manuscripts (`manuscripts.created_by`) for user-facing reads
- No silent fallback from artifacts to non-canonical report sources in `/api/evaluations/[jobId]`
- No unauthenticated fallback path in production for user job listing
- Header actor auth is hard-disabled in production

## QA/QC Verification Commands

- Compile: `npx tsc --noEmit`
- Governance guard: `npm run -s canon:guard`
- Targeted tests:
    - `npm run -s test -- tests/rate-limiting.test.ts tests/day1-evaluation-ui.test.ts tests/useJobs-polling-backoff.test.ts`
- Invariants:
    - `npm run -s jobs:validate`
- Smoke (requires service role key):
    - `npm run -s jobs:smoke`
