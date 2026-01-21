# UI_CONTRACT — Day-1 Evaluation UI (Jobs)

This document is the binding contract between the Day-1 Evaluation UI and the Job System.

The UI MUST ONLY render from the fields defined here and MUST NOT infer or invent job lifecycle semantics beyond this contract.

If the Job System changes any field shape or lifecycle meaning, this document must be updated first.

---

## Scope

Applies to:
- `/evaluate` (Day-1 evaluation entry + jobs list)
- Any UI that renders job status, phase, progress, or completion state
- The "View Evaluation Report" CTA behavior

Non-goals:
- Defining the internal job engine implementation
- Defining evaluation output schema (handled separately once output is surfaced)

---

## API Endpoints Used by the UI

### Create job
- `POST /api/jobs`
- Purpose: create an evaluation job of type `evaluate_full`

Expected request shape (Day-1):
- manuscript payload (text or reference) as implemented by the app
- `job_type: "evaluate_full"` (or equivalent canonical value)

Expected response (minimum UI needs):
- `job_id` (string UUID)
- `status` (string)

### Read jobs list
- `GET /api/jobs`
- Purpose: list jobs for display, sorted by recency

Expected response:
- `{ jobs: Job[] }`

### Optional per-job read (if UI uses it)
- `GET /api/jobs/[id]`
- Purpose: fetch a single job for deep status detail

---

## Canonical Job Fields the UI May Read

The UI may read ONLY these fields:

### Identity & timestamps
- `id: string`
- `job_type: string`
- `created_at: string` (ISO timestamp)
- `updated_at: string` (ISO timestamp)

### Status (top-level)
- `status: "queued" | "running" | "retry_pending" | "failed" | "complete" | "canceled"`

### Phase (top-level)
- `phase: "phase1" | "phase2" | null`
- `phase_status: "queued" | "running" | "complete" | "failed" | null`

### Progress (top-level, not inside JSON)
- `total_units: number`
- `completed_units: number`
- `failed_units: number`

### Error surface (optional)
- `last_error?: string | null`

### Progress snapshot object (read-only, optional)
- `progress?: object`
The UI MUST treat `progress` as an opaque snapshot and MUST NOT depend on nested fields for correctness unless explicitly listed in this contract in a future revision.

---

## Terminal State Semantics

A job is TERMINAL when:
- `status` is one of: `"complete" | "failed" | "canceled"`

When terminal:
- UI MUST freeze the job display in its final state
- UI MUST stop polling per Polling Rules
- UI MUST present a stable completion outcome (success/fail/canceled)

---

## Rendering Rules (Day-1 Tracks A/B/C)

### Ordering
Jobs are displayed sorted by:
- `created_at DESC` (newest first)

### Empty state (no jobs)
If `jobs.length === 0`:
- Show message: "No evaluations yet"
- Show CTA guidance: "Submit your manuscript above to run your first evaluation"

### Status badge mapping
UI displays a badge for `status`:
- `queued` → Queued
- `running` → Running
- `retry_pending` → Retrying
- `complete` → Complete
- `failed` → Failed
- `canceled` → Canceled

UI MUST NOT invent additional states.

### Queued "trust screen"
If `status === "queued"`:
- Show message: "Preparing evaluation… this usually takes ~2–3 minutes"
- UI may show a lightweight spinner or "preparing" icon
- Progress bar is optional; if shown, it must not imply completion percent if `total_units` is 0

### Running "trust screen"
If `status === "running"`:
- Show progress as `completed_units / total_units` only if `total_units > 0`
- Show relative time (e.g., "2 minutes ago") derived from timestamps
- Show elapsed duration if implemented (e.g., "Running for 1 minute")

### Phase-specific copy (Track C)
If `status === "running"` and `phase` is present:
- `phase === "phase1"`:
  - Primary: "Analyzing structure and craft…"
  - Secondary (optional): "Examining narrative elements, pacing, and technical execution"
- `phase === "phase2"`:
  - Primary: "Generating revision guidance…"
  - Secondary (optional): "Creating actionable feedback and recommendations"

If `phase` is null/unknown:
- UI must fall back to generic running copy (no guessing).

### Completion state (success)
If `status === "complete"`:
- Show a clear success banner with:
  - Title: "Evaluation Complete!"
  - Supporting text indicating the report is ready
  - Prominent CTA: "View Evaluation Report"
- UI MUST NOT continue polling
- UI MUST NOT display "running" indicators

### Failure state
If `status === "failed"`:
- Show a failure banner/message
- Optionally display `last_error` if present
- UI MUST stop polling
- UI MUST not show the completion CTA unless a future contract version defines a "partial report" concept

### Canceled state
If `status === "canceled"`:
- Show a canceled banner/message
- UI MUST stop polling
- UI MUST not show the completion CTA

---

## Polling Rules (Track C)

Polling is allowed ONLY while the relevant job is non-terminal.

### Recommended rule for Day-1
- Poll every N seconds while the MOST RECENT job (by created_at) has `status` not in terminal states
- Stop polling immediately when the most recent job reaches a terminal state

The UI MUST NOT poll indefinitely after a terminal status.

---

## UI Assumptions / Invariants

The UI may assume:
- `completed_units <= total_units`
- Terminal states do not regress back to non-terminal states within the same job id
- When `status === "complete"`, the job is terminal and will remain so

The UI MUST NOT assume:
- That `phase` is always present
- That `progress` JSON contains any required nested fields
- That `total_units > 0` (handle 0 safely)

---

## Contract Change Policy

Any change to:
- accepted values of `status`, `phase`, `phase_status`
- field locations (top-level vs inside `progress`)
- meaning of terminal states
- polling expectations

…requires updating this document FIRST, then updating the UI/tests.
