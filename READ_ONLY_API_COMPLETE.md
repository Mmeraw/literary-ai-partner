# Read-Only Job API Implementation

**Status**: ✅ Complete  
**Date**: 2026-01-26  
**Contract**: JOB_CONTRACT_v1 compliant

## Summary

Jobs now have a single source of truth: a locked contract, enforced vocabulary, passive observability, and a read-only API that exposes exactly what the system is doing—no inferred states, no invented progress.

## What Was Implemented

### 1. Canonical API Types ([lib/jobs/types.ts](lib/jobs/types.ts))

Added contract-aligned response types:

```typescript
// CANON: JobPhase is "phase_1" | "phase_2" | null
export type JobPhase = Phase | null;

// GOVERNANCE: phase_status is free-form (NOT a state machine)
export type PhaseStatus = string | null;

export type JobProgress = {
  phase_status?: PhaseStatus;
  completed_units?: number | null;
  total_units?: number | null;
  failed_units?: number | null;
  retry_count?: number | null;
};

export type JobRecord = {
  id: string;
  user_id: string;
  manuscript_id: string | number | null;
  job_type: string;
  
  // CANON: status and phase are the only real states
  status: JobStatus;
  phase: JobPhase;
  
  // Error surface
  last_error: string | null;
  
  // Counters (read-only)
  total_units: number | null;
  completed_units: number | null;
  failed_units: number | null;
  retry_count: number | null;
  
  // Timestamps (ISO strings)
  created_at: string;
  updated_at: string;
  last_heartbeat: string | null;
  next_retry_at: string | null;
  
  // Progress (optional debug/UX data)
  progress: JobProgress | null;
};

export type GetJobApiResponse =
  | { ok: true; job: JobRecord }
  | { ok: false; error: "Job not found" }
  | { ok: false; error: "Forbidden" };
```

### 2. Read-Only GET Endpoint ([app/api/jobs/[id]/route.ts](app/api/jobs/[id]/route.ts))

Replaced existing GET handler with contract-aligned version:

**What It Does**:
- ✅ Returns canonical job state only
- ✅ Maps internal `Job` to contract-aligned `JobRecord`
- ✅ No derived statuses
- ✅ No estimated times
- ✅ No fabricated progress

**What It Doesn't Do**:
- ❌ No `status` mutations
- ❌ No `phase_status` invention
- ❌ No ETAs or progress calculations
- ❌ No control flow changes
- ❌ **No new state machines introduced** (phase_status is free-form debug/UX hint only)

**Auth (Hook Points Present; Enforcement Pending)**:
```typescript
// User-scoped access control hook points ready
// Enforcement intentionally deferred until real auth is enabled
const userId = req.headers.get("x-user-id");
// if (!userId) return 403
// if (job.user_id !== userId) return 403
```

### 3. Response Examples

**Success (running job)**:
```json
{
  "ok": true,
  "job": {
    "id": "162b225d-75b7-4fa6-aeef-9a6b8a34664b",
    "user_id": "anonymous",
    "manuscript_id": 123,
    "job_type": "evaluate_full",
    "status": "running",
    "phase": "phase_1",
    "last_error": null,
    "total_units": 12,
    "completed_units": 3,
    "failed_units": 0,
    "retry_count": 0,
    "created_at": "2026-01-26T21:13:45.000Z",
    "updated_at": "2026-01-26T21:14:10.000Z",
    "last_heartbeat": "2026-01-26T21:14:09.000Z",
    "next_retry_at": null,
    "progress": {
      "phase_status": "phase_1_processing",
      "completed_units": 3,
      "total_units": 12,
      "failed_units": 0,
      "retry_count": 0
    }
  }
}
```

**Success (complete)**:
```json
{
  "ok": true,
  "job": {
    "id": "abc-123",
    "status": "complete",
    "phase": "phase_1",
    "last_error": null,
    ...
  }
}
```

**Failed job**:
```json
{
  "ok": true,
  "job": {
    "id": "def-456",
    "status": "failed",
    "phase": "phase_1",
    "last_error": "OpenAI API timeout after 3 retries",
    ...
  }
}
```

**Not found**:
```json
{
  "ok": false,
  "error": "Job not found"
}
```

## Governance Compliance

✅ **JOB_CONTRACT_v1**: No status/transition changes  
✅ **Read-Only**: GET only, no state mutations  
✅ **Canonical Truth**: Returns DB state without invention  
✅ **phase_status**: Free-form string (not a state machine)  
✅ **Canon Guard**: Passes all checks  
✅ **Contract Proof**: `npm run canon:guard` passed after endpoint changes (contract still locked)  
✅ **TypeScript**: No errors

## What's Next

### 1. Frontend Polling UI (`/evaluate/[jobId]`)

Implement client-side polling:

```typescript
// Example polling hook
function useJobStatus(jobId: string) {
  const [job, setJob] = useState<JobRecord | null>(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data: GetJobApiResponse = await response.json();
      
      if (data.ok) {
        setJob(data.job);
        
        // Stop polling on terminal status
        if (data.job.status === 'complete' || data.job.status === 'failed') {
          clearInterval(interval);
        }
      }
    }, 2000); // Poll every 2 seconds
    
    return () => clearInterval(interval);
  }, [jobId]);
  
  return job;
}
```

**UI Rendering**:
```tsx
function JobStatus({ jobId }: { jobId: string }) {
  const job = useJobStatus(jobId);
  
  if (!job) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Job Status: {job.status}</h2>
      {job.status === 'queued' && <p>Waiting to start...</p>}
      {job.status === 'running' && (
        <p>Processing: {job.completed_units} / {job.total_units}</p>
      )}
      {job.status === 'complete' && <a href={`/reports/${jobId}`}>View Report</a>}
      {job.status === 'failed' && (
        <div className="error">
          <p>Job failed</p>
          {job.last_error && <pre>{job.last_error}</pre>}
        </div>
      )}
      <p>Updated: {new Date(job.updated_at).toLocaleString()}</p>
    </div>
  );
}
```

### 2. Metrics Dashboard (Internal)

Create simple script to aggregate observability events:

```bash
# View recent events
grep "ObservabilityEvent" logs.txt | jq .

# Count events by type
grep "ObservabilityEvent" logs.txt | jq -r '.event_type' | sort | uniq -c

# Average duration by phase
grep "phase_completed" logs.txt | jq '.meta.duration_ms' | awk '{sum+=$1; n++} END {print sum/n}'
```

Or create a simple internal page: `/api/admin/metrics`

### 3. Quality Gate Definitions (Docs Only)

Create `docs/QUALITY_GATES_v1.md`:

```markdown
# Quality Gates v1

## Score Bands
- 0-40: Needs significant work
- 41-70: Solid foundation
- 71-85: Strong manuscript
- 86-100: Exceptional

## Confidence Thresholds
- < 0.5: Low confidence (flag for review)
- 0.5-0.8: Moderate confidence
- > 0.8: High confidence

## Agent-Ready Criteria
- Score ≥ 70
- Confidence ≥ 0.7
- No critical issues flagged
- Phase 1 complete
```

### 4. Later: Auth & Multi-Tenant

When first external user:
- Enable `x-user-id` checks in GET handler
- Add RLS policies in Supabase
- Separate prod/staging projects

---

**Bottom Line**: Users can now see truthful job status via polling. The UI consumes reality; it doesn't invent it.
