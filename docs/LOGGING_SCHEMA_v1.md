# Observability Logging Schema (LOGGING_SCHEMA_v1)

**Status**: NORMATIVE  
**Version**: 1.0.0  
**Last Updated**: 2026-02-08  
**Owner**: RevisionGrade Governance  

---

## Purpose

This document defines the canonical, audit-grade logging contract for all observability events in Phase C. It is the **single source of truth** for event shape, required fields, allowed values, and invariants.

All emitters **MUST** conform to this contract. Any deviation is a contract failure.

---

## Definitions

- **Event**: An immutable, append-only record representing a state change or observation.
- **Event Type**: Canonical name (e.g., `job.failed`) describing the event category.
- **Entity**: The primary thing being observed (for v1, `job`).
- **Correlation ID**: Ties events across phases/requests (e.g., request_id, trace_id).
- **Source Phase**: Where the event originated (`phase_1`, `phase_2`, `api`, `admin`, `system`).
- **Schema Version**: Contract version for forward compatibility (`v1`).
- **Envelope**: The minimal required diagnostic payload for failures (D1 failure envelope).

---

## Contract Invariants

### 1) Immutability
- Events are **append-only**.
- Events are **never** updated or deleted in normal operation.

### 2) Required Header Fields (All Events)
Every event **MUST** include the following fields:

- `event_id` (uuid)
- `event_type` (text)
- `schema_version` (text, default `v1`)
- `entity_type` (text, e.g., `job`)
- `entity_id` (text, canonical external ID)
- `occurred_at` (timestamptz)
- `recorded_at` (timestamptz)
- `source_phase` (text enum-like)
- `severity` (text enum-like)
- `payload` (jsonb)

### 3) Redaction & Safety
- **No secrets**: payloads MUST NOT contain API keys, passwords, tokens, authorization headers, or database connection strings.
- **No PII**: avoid raw user content; prefer IDs and hashes.
- CI enforces a **denylist scan** for forbidden keys/values. Violations are contract failures.

**Forbidden content (hard fail)**: Observability event payloads MUST NOT contain secrets or credentials, including but not limited to API keys, passwords, tokens, authorization headers, or database connection strings. CI enforces a denylist-based recursive scan of event payloads; violations are treated as contract failures and MUST block merge.

---

## Canonical Event Types (v1)

### Required Core Lifecycle Events
- `job.created`
- `job.claimed`
- `job.started`
- `job.completed`
- `job.failed`
- `job.retry_scheduled`
- `job.dead_lettered`

### Required Admin/Operator Events
- `admin.retry_requested`
- `admin.retry_executed`
- `admin.job_status_changed`

### Optional but Recommended
- `job.progress_updated`
- `job.artifact_written`
- `job.contract_violation_detected`

---

## Canonical Enums (Soft Enforcement, v1)

### source_phase
- `phase_1`
- `phase_2`
- `api`
- `admin`
- `system`

### severity
- `debug`
- `info`
- `warn`
- `error`
- `critical`

### entity_type
- `job`

---

## Failure Envelope Coupling (D1 Alignment)

When `event_type = job.failed`, the payload **MUST** include D1 fields:

- `failed_at` (ISO timestamp)
- `failure_reason` (error code or canonical reason)
- `attempt_count` (integer)

### Recommended (Optional) Fields
- `error.code`
- `error.message` (sanitized)
- `provider` / `model`
- `job.job_type`
- `env.runtime`

---

## Base Payload Shape (All Events)

```json
{
  "message": "human-readable short summary",
  "details": {}
}
```

---

## Example Payloads

### job.failed
```json
{
  "failed_at": "2026-02-08T04:26:18Z",
  "failure_reason": "NETWORK_UNREACHABLE",
  "attempt_count": 3,
  "error": {
    "code": "NETWORK_UNREACHABLE",
    "message": "connection to server failed: Network is unreachable"
  },
  "job": {
    "job_type": "phase_2_aggregate",
    "status": "failed"
  },
  "env": {
    "runtime": "github_actions",
    "region": "us-east-1"
  }
}
```

### admin.retry_requested
```json
{
  "reason": "Operator initiated retry after infra fix",
  "target_status": "queued",
  "previous_status": "failed",
  "job_id": "job_123",
  "attempt_count_before": 3
}
```

---

## Versioning & Compatibility

- **Current version**: `v1`
- **Forward compatibility**: new fields may be added to payload; existing required fields MUST remain.
- **Breaking changes**: require `v2` schema version and a formal migration.

---

## Idempotency (Optional)

If `idempotency_key` is provided, emitters **MUST** ensure it is stable for the intended dedupe scope. The store enforces uniqueness on:

```
(event_type, entity_type, entity_id, idempotency_key)
```

---

## Governance Notes

- This document is **normative** and governed by RevisionGrade rules.
- Any emitter change must update this contract.
- CI contract tests validate required fields and enforce forbidden-key scans.

---

## References

- D1 Failure Envelope: [FAILURE_ENVELOPE_v1.md](FAILURE_ENVELOPE_v1.md)
- Phase C Evidence Pack: [PHASE_C_EVIDENCE_PACK.md](../PHASE_C_EVIDENCE_PACK.md)
