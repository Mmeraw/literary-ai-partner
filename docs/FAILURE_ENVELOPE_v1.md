# FAILURE_ENVELOPE_v1

**Status:** ✅ Phase C D1 (Runtime Integration & Evidence)  
**Scope:** Job lifecycle states and failure semantics for RevisionGrade jobs  
**Enforcement Point:** `lib/jobs/jobStore.supabase.ts` → `mapDbRowToJob()`  
**Dependencies:** Phase A.1 (Structured Error Envelopes), Phase 2C (Canonical Result Envelopes)

---

## Purpose

This document defines the **Failure Envelope** for RevisionGrade jobs.

The failure envelope is the minimum, mandatory set of fields that must be present
for every job at every lifecycle state, ensuring failures are unambiguous,
retry behavior is explainable, and observability is reliable.

This envelope is enforced at the job read boundary via `mapDbRowToJob()` and combines:
- **Phase A.1 Error Code Contract**: Machine-parseable error codes (e.g., `RATE_LIMIT`, `INVALID_INPUT`)
- **Phase 2C Result Envelope**: Canonical success/failure outcomes with runtime metadata
- **Phase C Observability**: Required fields for querying, alerting, and debugging

---

## Canonical Status & Phase Fields

| Field | Type | Allowed Values | Description |
|-------|------|---|---|
| `status` | string | `queued` \| `running` \| `complete` \| `failed` | Canonical job state |
| `phase` | string | `phase_0` \| `phase_1` \| `phase_2` | Execution phase |
| `phase_status` | string | `pending` \| `running` \| `complete` \| `failed` | Phase-level status |
| `created_at` | ISO-8601 | timestamp | Job creation time |

---

## State-Specific Requirements

### status = `queued`

**Semantics:** Job has been created but not yet started.

**Required Fields:**
- `created_at` — timestamp of job creation
- `status` — must be `"queued"`

**Optional Fields:**
- `next_retry_at` — when scheduler should execute; omitted if immediate

---

### status = `running`

**Semantics:** Execution is in progress (Phase 1 or Phase 2).

**Required Fields:**
- `started_at` — timestamp when execution began
- `attempt_count` — must be ≥ 1 (first attempt is attempt 1)
- `status` — must be `"running"`
- `phase` — either `phase_1` or `phase_2`
- `phase_status` — must be `"running"`

**Optional Fields:**
- `completed_units` / `total_units` — progress within the phase

---

### status = `complete`

**Semantics:** Execution finished successfully; all units were processed.

**Required Fields:**
- `completed_at` — timestamp when completion occurred
- `completed_units` — number of units processed
- `total_units` — total number of units to process
- `status` — must be `"complete"`

**Invariant:**
- `completed_units == total_units`

**Optional Fields:**
- `result` or outcome data (from Phase 2C result envelope)
- `duration_ms` — wall-clock execution time

---

### status = `failed`

**Semantics:** Execution stopped due to an error.

**Required Fields:**
- `failed_at` — timestamp when failure was recorded
- `failure_reason` — machine-parseable failure code (from Phase A.1)
- `failure_message` — human-readable error description
- `attempt_count` — must be ≥ 1
- `status` — must be `"failed"`

**Canonical Failure Sub-Cases (Semantic):**

#### Canceled
- `progress.canceled_at` IS NOT NULL
- Semantics: Job was intentionally halted (operator action)
- Retry path: None (terminal state)

#### Retryable
- `progress.next_retry_at` IS NOT NULL
- `attempt_count < MAX_RETRIES`
- Semantics: Failure is transient; scheduler will retry at `next_retry_at`
- Retry path: Automatic via background job scheduler

#### Deadletter
- `attempt_count >= MAX_RETRIES`
- `progress.deadletter_routed_at` IS NOT NULL (optional; indicates routing occurred)
- Semantics: All retries exhausted; job is now in operator queue for manual investigation
- Retry path: Operator-driven (manual retry or job transformation)

---

## Error Classification (Phase A.1 Integration)

Every failed job MUST include a structured error code from the Phase A.1 taxonomy:

```typescript
// Partial list; see Phase A.1 COMPLETE.md for full taxonomy
failure_reason: 
  | "RATE_LIMIT"        // Provider rate limit exceeded
  | "INVALID_INPUT"     // Input validation failure
  | "PROVIDER_ERROR"    // API error (5xx, timeout, etc.)
  | "LEASE_EXPIRED"     // Distributed lock timeout
  | "TIMEOUT"           // Operation exceeded deadline
  | "INTERNAL_ERROR"    // RevisionGrade bug
  | "UNKNOWN"           // Unknown error class
```

---

## Runtime Metadata (Phase 2C Integration)

Every job failure MUST include metadata for observability:

```json
{
  "provider_meta": {
    "provider": "openai",
    "model": "gpt-4",
    "request_id": "req-12345",
    "latency_ms": 2500,
    "retries": 1,
    "circuit_breaker": { "state": "closed" }
  },
  "openai_runtime": {
    "model": "gpt-4",
    "temperature": 0.7,
    "max_output_tokens": 2048
  }
}
```

---

## Enforcement Point

All job reads are normalized through:

```typescript
// filepath: lib/jobs/jobStore.supabase.ts
export function mapDbRowToJob(row: DbJob): Job {
  // Normalize and enforce failure envelope contract
  // - Validate required fields per state
  // - Populate defaults for compatibility
  // - Ensure error codes are recognized
  return { /* normalized job */ };
}
```

**Why:** This is the single point where all job data flows back into application code.
By enforcing the envelope here, downstream systems (observability, retry, deadletter) can rely
on the contract being true.

---

## Non-Goals

This document does NOT define:

- **Logging Formats** (see Phase C D2 – Structured Logging)
  - How to emit structured logs for each state transition
  - JSON schema for log records
  
- **Observability Queries** (see Phase C D3)
  - SQL queries to detect stuck jobs, failure rates, etc.
  - Alert thresholds for failure counts

- **Deadletter Storage** (deferred; post-D4)
  - Migration for `deadletter_jobs` table
  - Operator runbook mechanics

- **Health Dashboard UI** (see Phase C D5)
  - Tile layouts, auto-refresh, visualization

---

## Proof Criteria

For Phase C D1 to be marked **DONE**, the following must be verified:

1. ✅ All job states (queued, running, complete, failed) have explicit field requirements defined (this doc).
2. ✅ All failed jobs in production data emit `failure_reason` with a recognized error code.
3. ✅ All failed jobs in production data include `failed_at` and `attempt_count` (validated via SQL probe).
4. ✅ Semantic sub-cases (canceled, retryable, deadletter) are correctly identified via field presence.
5. ✅ The enforcement point (`mapDbRowToJob()`) validates the envelope contract (unit-tested).

**SQL Proof Query** (see `docs/queries/OBSERVABILITY_QUERIES_v1.sql` – "D1 Failure Envelope Data Integrity Check"):

```sql
SELECT COUNT(*) as missing_fields_count
FROM jobs
WHERE status = 'failed'
AND (
  progress->>'failed_at' IS NULL
  OR progress->>'failure_reason' IS NULL
  OR progress->>'attempt_count' IS NULL
);

-- Expected result: 0 rows
-- If > 0, the failure envelope contract is violated.
```

---

## Cross-Phase Dependencies

| Phase | Artifact | Usage |
|-------|----------|-------|
| Phase A.1 | `docs/PHASE_A1_COMPLETE.md` | Error code taxonomy and retryability rules |
| Phase 2C | `docs/PHASE2C_EVIDENCE_COMMAND.md` | Runtime metadata schema (provider_meta, openai_runtime) |
| Phase C D1 | **This document** | Job lifecycle and failure envelope contract |
| Phase C D2 | `lib/jobs/logging.ts` | Emit failure envelope on every state transition |
| Phase C D3 | `docs/queries/OBSERVABILITY_QUERIES_v1.sql` | Query failure envelopes for observability |
| Phase C D4 | `docs/PHASE_C_D4_OBSERVABILITY_COVERAGE.md` | Observability coverage & event completeness |
| Deferred | Deadletter formalization | Post-D4 item (deadletter routing + table) |
| Phase C D5 | Dashboard UI | Visualize failure envelope fields (error codes, attempt counts) |

---

## Versioning & Change Control

**Version:** v1  
**Frozen:** Phase C D1 completion (Feb 8–15, 2026)  
**Change Control:** Any addition to the failure envelope requires a CCR (Change Control Request) and evidence that observability queries and deadletter routing still work correctly.

