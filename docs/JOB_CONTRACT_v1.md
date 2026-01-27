# JOB_CONTRACT_v1

**Status**: CANON (binding)  
**Version**: v1  
**Last Updated**: 2026-01-26  
**Owner**: RevisionGrade Governance

## 0. Purpose

This document defines the canonical ("CANON") job system contract for RevisionGrade.
It is binding. Code must not invent states, infer transitions, or fabricate progress.
Any change to CANON requires explicit versioning (v2) and a migration plan.

## 1. Definitions

- **Job**: A durable unit of work for evaluating a manuscript.
- **State**: The canonical job status (e.g., queued, running, complete, failed).
- **Transition**: A move from one state to another, only allowed by this contract.
- **Auditability**: State is persisted and reconstructable from DB + logs.
- **Governance**: Rules that prevent drift, silent failures, or ambiguous truth.

## 2. Canonical Entities

### 2.1 evaluation_jobs (source of truth)
The database is the single source of truth for job state.

**Canonical fields (minimum contract)**:
- `id` (uuid)
- `manuscript_id` (bigint)
- `job_type` (text)
- `status` (text) — MUST be one of JobStatus (Section 3)
- `progress` (jsonb) — MAY be empty but if present must comply with Section 4
- `created_at`, `updated_at` (timestamptz)
- `last_error` (text|null)
- `retry_count` (int)
- `last_heartbeat` (timestamptz|null)

## 3. Canonical Status Model

### 3.1 JobStatus (CANON)
**Allowed values**:
- `queued`
- `running`
- `complete`
- `failed`

**No other status values are permitted.**

### 3.2 Terminal Statuses (CANON)
**Terminal statuses**:
- `complete`
- `failed`

**Terminal means**: no further processing is allowed unless a new job is created.

## 4. Progress Contract (jsonb)

`progress` is a JSON object used to provide structured phase information.
It MUST NOT contradict `status`.

### 4.1 Canonical progress shape (minimum)
- `phase`: `"phase0"` | `"phase1"` | `"phase2"` | `null`
- `phase_status`: `"queued"` | `"running"` | `"complete"` | `"failed"` | `null`
- `units_total`: `number` | `null`
- `units_completed`: `number` | `null`

`progress` may include additional non-canon keys, but CANON keys must match this meaning.

### 4.2 Consistency rules (CANON)
- If `status = queued`, then `progress.phase_status` MUST NOT be `"running"` or `"complete"`.
- If `status = running`, then `progress.phase_status` MAY be `"running"`.
- If `status = complete`, then `progress.phase_status` MUST be `"complete"` (or null if legacy).
- If `status = failed`, then `progress.phase_status` MUST be `"failed"` (or null if legacy).

## 5. Allowed Transitions

### 5.1 State transition table (CANON)

**Allowed**:
- `queued` → `running`
- `running` → `complete`
- `running` → `failed`
- `queued` → `failed` (only for validation hard-fail before processing begins)

**Disallowed (must throw / hard error)**:
- `complete` → any
- `failed` → any
- `queued` → `complete` (skips processing)
- `failed` → `running` (resurrection)
- `complete` → `running` (reopen)

### 5.2 Transition enforcement (CANON)
All transitions must be validated by a single centralized validator:
- `assertValidJobTransition(from, to)`

Illegal transitions must:
- refuse to write to DB
- emit an error with explicit "illegal transition" semantics

## 6. API Contract

### 6.1 Create Job: POST /api/jobs
**Required input**:
- `manuscript_id`
- `job_type`

**Optional**:
- `manuscript_size` (bytes)
- `user_tier` (`"free"` | `"premium"` | `"agent"`)

**Required behavior**:
- Rate limit enforced (429 on denial)
- Size validation (413 on denial)
- Feature access control (403 on denial)
- On success: job is created with `status=queued`

**Response (success)**:
- `ok: true`
- `job_id`
- `status`

**Response (failure)**:
- `ok: false`
- `error`
- optional `retry_after` (only for 429)

### 6.2 List Jobs: GET /api/jobs
Returns list of jobs (implementation may scope by user in future).
MUST NOT fabricate or infer status.

## 7. Auth / Ownership (Governance)

Until full auth is implemented:
- `x-user-id` is treated as the user identifier for gating features
- If absent, feature access may be limited depending on `policy_family`

No endpoint may claim "auth enforced" unless validated by tests.

## 8. Error Semantics (CANON)

- **400**: Invalid JSON body OR missing required fields
- **401**: Authentication required (future; only if enforced)
- **403**: Feature access denied / tier restriction
- **413**: Manuscript too large
- **429**: Rate limited
- **500**: System fault (DB failure, worker failure, unexpected exception)

**Rules**:
- Do not return 400 for a DB outage.
- Do not return 200 for a failed job creation.
- Errors must be explicit and non-ambiguous.

## 9. Observability (Governance)

Metrics and logs must be passive:
- They may observe job creation and transitions
- They must not alter control flow

**Minimum observability events**:
- `job.created`
- `job.transition` (from→to)
- `job.failed` (error_code + message)
- `phase.started` / `phase.completed`

## 10. Versioning

This is v1.

Any change to:
- JobStatus
- Transition table
- Progress canonical keys meaning

requires:
- JOB_CONTRACT_v2
- migration plan
- tests proving backward compatibility or deliberate break

---

**END OF CONTRACT**
