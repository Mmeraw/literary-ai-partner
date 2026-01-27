# Metrics API v1

**Version**: 1.0  
**Status**: Active  
**Canonical Source**: This document  
**Endpoint**: `GET /api/admin/metrics`

---

## Purpose

Provides **read-only operational visibility** into the job system without affecting job control flow or state transitions.

This endpoint returns:
- Factual counts of jobs by canonical status
- Detection of stale running jobs (using factual threshold)
- Recent observability events as recorded

**GOVERNANCE**: This API exposes truth only. No derived states, no ETAs, no health scores.

---

## Request

```http
GET /api/admin/metrics
X-Admin-Key: <optional_auth_token>
```

**Authentication**: Currently optional (no-op). Will be enforced during multi-tenant hardening (Option D).

---

## Response

### Success (200 OK)

```json
{
  "ok": true,
  "metrics": {
    "timestamp": "2026-01-26T12:34:56.789Z",
    "job_counts": {
      "queued": 5,
      "running": 2,
      "complete": 143,
      "failed": 7,
      "retry_pending": 1
    },
    "stale_running_jobs": {
      "count": 1,
      "threshold_minutes": 15
    },
    "recent_events": [
      {
        "job_id": "550e8400-e29b-41d4-a716-446655440000",
        "event_type": "phase_completed",
        "phase": "phase_1",
        "timestamp": "2026-01-26T12:34:50.123Z",
        "meta": { "duration_ms": 4523 }
      },
      {
        "job_id": "660e8400-e29b-41d4-a716-446655440001",
        "event_type": "job_created",
        "phase": null,
        "timestamp": "2026-01-26T12:33:21.456Z",
        "meta": { "job_type": "evaluate_quick" }
      }
    ]
  }
}
```

**Headers**:
```
Cache-Control: no-store, must-revalidate
```

### Error (500 Internal Server Error)

```json
{
  "ok": false,
  "error": "Internal server error"
}
```

---

## Response Schema

### `MetricsSnapshot`

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | `string` | ISO 8601 timestamp of when snapshot was taken |
| `job_counts` | `JobCountsByStatus` | Count of jobs by canonical status |
| `stale_running_jobs` | `StaleRunningJobsInfo` | Factual detection of stuck jobs |
| `recent_events` | `Array<ObservabilityEventSnapshot>` | Last 50 events as recorded |

### `JobCountsByStatus`

| Field | Type | Description |
|-------|------|-------------|
| `queued` | `number` | Jobs with status=queued |
| `running` | `number` | Jobs with status=running |
| `complete` | `number` | Jobs with status=complete (terminal) |
| `failed` | `number` | Jobs with status=failed (terminal) |
| `retry_pending` | `number` | Jobs with status=retry_pending |

**NOTE**: `canceled` is NOT canonical per JOB_CONTRACT_v1 but may appear in DB (implementation extension).

### `StaleRunningJobsInfo`

| Field | Type | Description |
|-------|------|-------------|
| `count` | `number` | Number of jobs matching criteria |
| `threshold_minutes` | `number` | Factual threshold used (15 minutes) |

**Definition**: Jobs with `status=running` AND `last_heartbeat` older than `threshold_minutes`.

**GOVERNANCE**: This is a factual count, not a health score. No interpretation of "system degraded" or "needs intervention" is provided.

### `ObservabilityEventSnapshot`

| Field | Type | Description |
|-------|------|-------------|
| `job_id` | `string` | Job UUID |
| `event_type` | `string` | One of: `job_created`, `phase_completed`, `job_failed`, `job_completed`, `job_canceled`, `retry_scheduled` |
| `phase` | `string \| null` | Phase identifier (e.g., "phase_1") or null |
| `timestamp` | `string` | ISO 8601 timestamp of event |
| `meta` | `object` | Event metadata (varies by event_type) |

---

## Governance Rules

### ✅ ALLOWED (Passive Observation)

- Count jobs WHERE status = X
- Show `last_heartbeat` timestamp verbatim from DB
- Calculate `stale_running_jobs.count` using factual threshold (15 minutes)
- Return raw observability events as recorded
- Return job counts by canonical status

### ❌ FORBIDDEN (Derived State)

- "Estimated time remaining"
- "Health score" or "system status: degraded"
- Inventing job progress percentages not in DB
- Displaying statuses not in JOB_CONTRACT_v1
- Aggregating across jobs to infer system state beyond counts
- Interpreting what stale job counts "mean" (e.g., "system overloaded")

**Key Principle**: The metrics endpoint **reads** what exists. It doesn't **interpret** what it means.

---

## Implementation Notes

### Current State (v1)

- **Event Storage**: In-memory buffer (last 500 events)
- **Event Retrieval**: `getRecentEvents(50)` from `lib/jobs/metrics.ts`
- **Job Queries**: `getAllJobs()` from `lib/jobs/store.ts`
- **Auth**: No-op (TODO: enable in Option D)

### Future Enhancements

- **Event Persistence**: Swap in-memory buffer with Supabase append-only `observability_events` table
- **Auth**: Enable `X-Admin-Key` header validation against `ADMIN_API_KEY` env var
- **Filtering**: Add query params for filtering events by `job_id`, `event_type`, or date range
- **Pagination**: Add pagination for large event sets (currently returns last 50)

---

## Related Documents

- [JOB_CONTRACT_v1.md](./JOB_CONTRACT_v1.md) - Canonical job status definitions
- [QUALITY_GATES_v1.md](./QUALITY_GATES_v1.md) - Policy documentation for quality thresholds

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-26 | Initial release: read-only metrics endpoint with factual counts and events |
