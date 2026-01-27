# Passive Observability Implementation

**Status**: ✅ Complete  
**Date**: 2026-01-26  
**Contract**: JOB_CONTRACT_v1 compliant

## What Was Added

### 1. Observability Event Types ([lib/jobs/metrics.ts](lib/jobs/metrics.ts))

```typescript
export type ObservabilityEventType =
  | "job_created"
  | "phase_completed"
  | "job_failed"
  | "job_completed"
  | "job_canceled"
  | "retry_scheduled";

export type ObservabilityEvent = {
  job_id: string;
  event_type: ObservabilityEventType;
  phase?: string;
  meta?: Record<string, unknown>;
};
```

### 2. Passive Event Recorder

```typescript
export async function recordEvent(evt: ObservabilityEvent): Promise<void>
```

**Guarantees**:
- ✅ Never throws (wrapped in `safeMetricAsync`)
- ✅ Best-effort only
- ✅ No-op unless `METRICS_ENABLED=true`
- ✅ Does not affect job state or control flow
- ✅ Vendor-agnostic (console backend by default)

### 3. Wired Into Existing Hooks

All existing metric hooks now emit observability events:

- `onJobCreated()` → `recordEvent({ event_type: "job_created" })`
- `onPhaseCompleted()` → `recordEvent({ event_type: "phase_completed" })`
- `onJobFailed()` → `recordEvent({ event_type: "job_failed" })`
- `onJobCompleted()` → `recordEvent({ event_type: "job_completed" })`
- `onJobCanceled()` → `recordEvent({ event_type: "job_canceled" })`
- `onRetryScheduled()` → `recordEvent({ event_type: "retry_scheduled" })`

Pattern: `void recordEvent(...)` — Fire-and-forget, non-blocking

### 4. TypeScript Fixes ([lib/jobs/store.ts](lib/jobs/store.ts))

- Fixed: Uncommented `import type { Job } from "./types"`
- Fixed: Formatting in `canRunPhase()` function
- Added: CANON marker to phase gating logic

## Usage

### Enable Observability

```bash
export METRICS_ENABLED=true
export METRICS_BACKEND=console  # or datadog, cloudwatch, custom
```

### View Events

When enabled, you'll see structured logs:

```json
{
  "ObservabilityEvent": {
    "job_id": "uuid",
    "event_type": "job_created",
    "phase": null,
    "meta": { "job_type": "evaluate_full" }
  }
}
```

### Extend to Supabase (Later)

To persist events to a database:

1. Create append-only table: `job_observability_events`
2. Extend backend in `registerBackend()`:
   ```typescript
   registerBackend("supabase", {
     increment: (metric, tags) => {
       // Insert into job_observability_events
     },
     // ...
   });
   ```
3. Set `METRICS_BACKEND=supabase`

## Governance Compliance

✅ **JOB_CONTRACT_v1**: No changes to job statuses or transitions  
✅ **Passive Only**: Events observe state, never alter it  
✅ **Never Throws**: All errors swallowed and logged  
✅ **Canon Guard**: Passes all checks  
✅ **TypeScript**: No errors

## What's Next (Safe to Implement)

1. **Read-Only Job API**
   - `GET /api/jobs/:job_id` — Returns canonical job state
   - No derived statuses
   - User-scoped (x-user-id)

2. **Frontend Polling UI**
   - Poll `GET /api/jobs/:job_id` every 1-2 seconds
   - Render truthful status: queued → running → complete/failed
   - No "estimated time" or fake progress

3. **Quality Gate Definitions** (policy only)
   - Document score bands
   - Document confidence thresholds
   - Do NOT enforce yet

4. **Later: Multi-Tenant Hardening**
   - When first external user arrives
   - RLS policies, prod Supabase split, backups

---

**Key Principle**: Observability is passive truth-gathering, not decision-making. The job system remains the single source of truth.
