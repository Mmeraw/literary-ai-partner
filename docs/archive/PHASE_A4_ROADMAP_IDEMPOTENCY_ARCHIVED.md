# Phase A.4: Idempotent "Run Phase" Endpoints — Roadmap

**Previous:** Phase A.3 (Dead-Letter Queue UI) ✅  
**Current:** Phase A.4 (Idempotent phase execution + state guards)  
**Next:** Phase B (Provider call execution hardening)

---

## Goal

Make all "run phase" API endpoints idempotent and safe:
- Replays don't double-run work
- State machine guards prevent illegal transitions
- Evidence + tests prove correctness

---

## Existing Endpoints

1. **`POST /api/jobs/[jobId]/run-phase1`**
   - File: [app/api/jobs/[jobId]/run-phase1/route.ts](../app/api/jobs/[jobId]/run-phase1/route.ts)
   - Current: Runs Phase 1 (chunking)
   - **Needs:** Idempotency check (don't re-run if phase1 already complete)

2. **`POST /api/jobs/[jobId]/run-phase2`**
   - File: [app/api/jobs/[jobId]/run-phase2/route.ts](../app/api/jobs/[jobId]/run-phase2/route.ts)
   - Current: Runs Phase 2 (evaluation)
   - **Needs:** Idempotency check + Phase 1 prerequisite check

---

## Implementation Checklist

### 1. Add State Guard Helper
**File:** `lib/jobs/state-guards.ts` (new)

```typescript
/**
 * Check if Phase 1 can be run for a job
 * Returns: { canRun: boolean, reason?: string }
 */
export function canRunPhase1(job: EvaluationJob): { canRun: boolean; reason?: string } {
  // Phase 1 already complete
  if (job.phase_status === 'complete' && job.phase === 'phase_1') {
    return { canRun: false, reason: 'Phase 1 already complete' };
  }

  // Job is leased by another worker
  if (job.lease_until && new Date(job.lease_until) > new Date()) {
    return { canRun: false, reason: 'Job is currently leased by another worker' };
  }

  // Job is in terminal status
  if (job.status === 'complete' || job.status === 'canceled') {
    return { canRun: false, reason: `Job status is ${job.status}` };
  }

  return { canRun: true };
}

/**
 * Check if Phase 2 can be run for a job
 * Returns: { canRun: boolean, reason?: string }
 */
export function canRunPhase2(job: EvaluationJob): { canRun: boolean; reason?: string } {
  // Phase 1 not complete
  if (job.phase !== 'phase_1' || job.phase_status !== 'complete') {
    return { canRun: false, reason: 'Phase 1 must be complete before running Phase 2' };
  }

  // Phase 2 already complete
  if (job.phase === 'phase_2' && job.phase_status === 'complete') {
    return { canRun: false, reason: 'Phase 2 already complete' };
  }

  // Job is leased by another worker
  if (job.lease_until && new Date(job.lease_until) > new Date()) {
    return { canRun: false, reason: 'Job is currently leased by another worker' };
  }

  // Job is in terminal status
  if (job.status === 'complete' || job.status === 'canceled') {
    return { canRun: false, reason: `Job status is ${job.status}` };
  }

  return { canRun: true };
}
```

### 2. Update run-phase1 Endpoint
**File:** [app/api/jobs/[jobId]/run-phase1/route.ts](../app/api/jobs/[jobId]/run-phase1/route.ts)

```typescript
import { canRunPhase1 } from '@/lib/jobs/state-guards';

export async function POST(req: Request, context: RouteContext) {
  // ... auth checks ...

  // Fetch job
  const { data: job, error } = await supabase
    .from('evaluation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
  }

  // STATE GUARD: Check if Phase 1 can run
  const guard = canRunPhase1(job);
  if (!guard.canRun) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: 400 } // Or 409 for conflict
    );
  }

  // ... proceed with Phase 1 execution ...
}
```

### 3. Update run-phase2 Endpoint
**File:** [app/api/jobs/[jobId]/run-phase2/route.ts](../app/api/jobs/[jobId]/run-phase2/route.ts)

```typescript
import { canRunPhase2 } from '@/lib/jobs/state-guards';

export async function POST(req: Request, context: RouteContext) {
  // ... auth checks ...

  // Fetch job
  const { data: job, error } = await supabase
    .from('evaluation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !job) {
    return NextResponse.json({ ok: false, error: 'Job not found' }, { status: 404 });
  }

  // STATE GUARD: Check if Phase 2 can run
  const guard = canRunPhase2(job);
  if (!guard.canRun) {
    return NextResponse.json(
      { ok: false, error: guard.reason },
      { status: 400 }
    );
  }

  // ... proceed with Phase 2 execution ...
}
```

### 4. Add Tests
**File:** `tests/run-phase-idempotency.test.ts` (new)

```typescript
describe('Phase Execution Idempotency', () => {
  describe('POST /api/jobs/:id/run-phase1', () => {
    it('rejects replay if Phase 1 already complete', async () => {
      // Create job with phase_1 complete
      const job = await createJob({ 
        manuscript_id: 123, 
        job_type: 'full_evaluation',
        phase: 'phase_1',
        phase_status: 'complete'
      });

      const res = await fetch(`/api/jobs/${job.id}/run-phase1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` }
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already complete');
    });

    it('rejects if job is leased by another worker', async () => {
      // Create job with active lease
      const job = await createJob({ 
        manuscript_id: 123,
        job_type: 'full_evaluation',
        lease_until: new Date(Date.now() + 60000).toISOString()
      });

      const res = await fetch(`/api/jobs/${job.id}/run-phase1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` }
      });

      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error).toContain('leased');
    });

    it('allows Phase 1 if prerequisites met', async () => {
      const job = await createJob({ 
        manuscript_id: 123,
        job_type: 'full_evaluation'
      });

      const res = await fetch(`/api/jobs/${job.id}/run-phase1`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` }
      });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/jobs/:id/run-phase2', () => {
    it('rejects if Phase 1 not complete', async () => {
      const job = await createJob({ 
        manuscript_id: 123,
        job_type: 'full_evaluation',
        phase: 'phase_1',
        phase_status: 'running'
      });

      const res = await fetch(`/api/jobs/${job.id}/run-phase2`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` }
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Phase 1 must be complete');
    });

    it('rejects replay if Phase 2 already complete', async () => {
      const job = await createJob({ 
        manuscript_id: 123,
        job_type: 'full_evaluation',
        phase: 'phase_2',
        phase_status: 'complete'
      });

      const res = await fetch(`/api/jobs/${job.id}/run-phase2`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` }
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already complete');
    });

    it('allows Phase 2 if Phase 1 complete and not leased', async () => {
      const job = await createJob({ 
        manuscript_id: 123,
        job_type: 'full_evaluation',
        phase: 'phase_1',
        phase_status: 'complete'
      });

      const res = await fetch(`/api/jobs/${job.id}/run-phase2`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}` }
      });

      expect(res.status).toBe(200);
    });
  });
});
```

---

## Verification

### 1. State Guard Tests Pass
```bash
npm test -- tests/run-phase-idempotency.test.ts
```

### 2. Manual Smoke Test
```bash
# Create job
JOB_ID=$(curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 123, "job_type": "full_evaluation"}' \
  | jq -r '.job.id')

# Run Phase 1
curl -X POST http://localhost:3000/api/jobs/$JOB_ID/run-phase1 \
  -H "Authorization: Bearer $SERVICE_KEY"

# Try to run Phase 1 again (should reject)
curl -X POST http://localhost:3000/api/jobs/$JOB_ID/run-phase1 \
  -H "Authorization: Bearer $SERVICE_KEY"
# Expected: 400 "Phase 1 already complete"

# Run Phase 2
curl -X POST http://localhost:3000/api/jobs/$JOB_ID/run-phase2 \
  -H "Authorization: Bearer $SERVICE_KEY"

# Try to run Phase 2 again (should reject)
curl -X POST http://localhost:3000/api/jobs/$JOB_ID/run-phase2 \
  -H "Authorization: Bearer $SERVICE_KEY"
# Expected: 400 "Phase 2 already complete"
```

---

## Estimated Effort
**Time:** 3-4 hours  
**Complexity:** Medium (requires understanding of job lifecycle)

---

## Next: Phase B

**Goal:** Provider call execution hardening

### Must-haves:
1. Reliable "claim provider call" loop
2. Strict retry/backoff on provider calls (distinct from job retries)
3. Evidence + metrics (rate, error envelopes, latency)

### Files to create:
- `workers/providerCallWorker.ts` (new)
- `lib/providers/retry-policy.ts` (new)
- Tests for provider call idempotency

---

**Last Updated:** 2026-01-30  
**Status:** Phase A.4 roadmap ready
