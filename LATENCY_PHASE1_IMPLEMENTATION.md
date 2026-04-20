# Latency Phase 1 Implementation Guide

## Objective
Instrument job creation → Pass 3 entry with precise timestamps to measure and attribute early-pipeline latency.

## Database Migration

Create: `supabase/migrations/$(date +%Y%m%d%H%M%S)_add_latency_phase1_timestamps.sql`

```sql
-- Add latency measurement timestamps to evaluation_jobs
-- Phase 1: Job Creation → Pass 3 Entry Observability

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS kickoff_attempted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS kickoff_dispatched_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pass1_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pass1_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pass2_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pass2_completed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pass3_started_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.evaluation_jobs.kickoff_attempted_at IS 
  'Timestamp when triggerEvaluationWorker was entered';
COMMENT ON COLUMN public.evaluation_jobs.kickoff_dispatched_at IS 
  'Timestamp when worker HTTP dispatch succeeded';
COMMENT ON COLUMN public.evaluation_jobs.pass1_started_at IS 
  'Timestamp when Pass 1 evaluation began';
COMMENT ON COLUMN public.evaluation_jobs.pass1_completed_at IS 
  'Timestamp when Pass 1 completed';
COMMENT ON COLUMN public.evaluation_jobs.pass2_started_at IS 
  'Timestamp when Pass 2 evaluation began';
COMMENT ON COLUMN public.evaluation_jobs.pass2_completed_at IS 
  'Timestamp when Pass 2 completed';
COMMENT ON COLUMN public.evaluation_jobs.pass3_started_at IS 
  'Timestamp when Pass 3 evaluation began';
```

## Code Changes

### 1. Job Creation Path (`app/api/jobs/route.ts`)

After `createJob()` succeeds, before calling `triggerEvaluationWorker()`:

```typescript
// Record kickoff attempt timestamp
const kickoffAttemptedAt = new Date();

void triggerEvaluationWorker({
  req,
  jobId: job.id,
  trace_id,
  request_id,
  source: "api.jobs.create",
  kickoffAttemptedAt, // Pass this through
});
```

### 2. Trigger Worker Helper (`lib/jobs/triggerWorker.ts`)

Add `kickoffAttemptedAt` to interface and persist timestamps:

```typescript
export interface TriggerWorkerArgs {
  req: Request;
  jobId: string;
  trace_id: string;
  request_id: string;
  source: string;
  kickoffAttemptedAt?: Date; // NEW
}

export async function triggerEvaluationWorker(
  args: TriggerWorkerArgs
): Promise<void> {
  const { req, jobId, trace_id, request_id, source, kickoffAttemptedAt } = args;
  
  // PERSIST kickoff_attempted_at if provided
  if (kickoffAttemptedAt) {
    await supabaseAdmin
      .from('evaluation_jobs')
      .update({ kickoff_attempted_at: kickoffAttemptedAt.toISOString() })
      .eq('id', jobId);
  }

  // ... existing secret/URL checks ...

  try {
    const response = await fetch(workerUrl, {...});
    
    if (!response.ok) {
      logger.warn('Worker kickoff returned non-ok response', {...});
      return;
    }

    // PERSIST kickoff_dispatched_at on success
    const kickoffDispatchedAt = new Date();
    await supabaseAdmin
      .from('evaluation_jobs')
      .update({ kickoff_dispatched_at: kickoffDispatchedAt.toISOString() })
      .eq('id', jobId);

    logger.info('Worker kickoff dispatched', {
      trace_id,
      request_id,
      event: 'worker.kickoff.dispatched',
      job_id: jobId,
      source,
      worker_url: workerUrl,
      kickoff_dispatched_at: kickoffDispatchedAt.toISOString(),
    });
  } catch (error) {
    logger.warn('Worker kickoff failed (network/timeout)', {...});
  }
}
```

### 3. Processor Pass Boundaries (`lib/evaluation/processor.ts`)

Instrument each Pass boundary:

```typescript
// At Pass 1 START
const pass1StartedAt = new Date();
await supabaseAdmin
  .from('evaluation_jobs')
  .update({ pass1_started_at: pass1StartedAt.toISOString() })
  .eq('id', jobId);

// ... Run Pass 1 ...

// At Pass 1 COMPLETE
const pass1CompletedAt = new Date();
await supabaseAdmin
  .from('evaluation_jobs')
  .update({ pass1_completed_at: pass1CompletedAt.toISOString() })
  .eq('id', jobId);

// At Pass 2 START  
const pass2StartedAt = new Date();
await supabaseAdmin
  .from('evaluation_jobs')
  .update({ pass2_started_at: pass2StartedAt.toISOString() })
  .eq('id', jobId);

// ... Run Pass 2 ...

// At Pass 2 COMPLETE
const pass2CompletedAt = new Date();
await supabaseAdmin
  .from('evaluation_jobs')
  .update({ pass2_completed_at: pass2CompletedAt.toISOString() })
  .eq('id', jobId);

// At Pass 3 START
const pass3StartedAt = new Date();
await supabaseAdmin
  .from('evaluation_jobs')
  .update({ pass3_started_at: pass3StartedAt.toISOString() })
  .eq('id', jobId);
```

## Verification Queries

Create: `docs/latency-phase1-queries.sql`

```sql
-- 1. Exact Job Verification
SELECT
  id,
  status,
  phase,
  phase_status,
  claimed_by,
  claimed_at,
  kickoff_attempted_at,
  kickoff_dispatched_at,
  pass1_started_at,
  pass1_completed_at,
  pass2_started_at,
  pass2_completed_at,
  pass3_started_at,
  created_at,
  updated_at
FROM public.evaluation_jobs
WHERE id = '<FRESH_JOB_ID>';

-- 2. Derived Timing Metrics
SELECT
  id,
  EXTRACT(EPOCH FROM (kickoff_dispatched_at - created_at)) * 1000 AS dispatch_delay_ms,
  EXTRACT(EPOCH FROM (claimed_at - created_at)) * 1000 AS claim_delay_ms,
  EXTRACT(EPOCH FROM (pass1_started_at - claimed_at)) * 1000 AS post_claim_startup_ms,
  EXTRACT(EPOCH FROM (pass1_completed_at - pass1_started_at)) * 1000 AS pass1_duration_ms,
  EXTRACT(EPOCH FROM (pass2_completed_at - pass2_started_at)) * 1000 AS pass2_duration_ms,
  EXTRACT(EPOCH FROM (pass3_started_at - created_at)) * 1000 AS time_to_pass3_ms
FROM public.evaluation_jobs
WHERE id = '<FRESH_JOB_ID>';

-- 3. Recent Batch Analysis
SELECT
  id,
  created_at,
  EXTRACT(EPOCH FROM (claimed_at - created_at)) * 1000 AS claim_delay_ms,
  EXTRACT(EPOCH FROM (pass1_started_at - claimed_at)) * 1000 AS post_claim_startup_ms,
  EXTRACT(EPOCH FROM (pass1_completed_at - pass1_started_at)) * 1000 AS pass1_duration_ms,
  EXTRACT(EPOCH FROM (pass2_completed_at - pass2_started_at)) * 1000 AS pass2_duration_ms,
  EXTRACT(EPOCH FROM (pass3_started_at - created_at)) * 1000 AS time_to_pass3_ms
FROM public.evaluation_jobs
WHERE created_at >= NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 10;
```

## Acceptance Test

1. Run migration
2. Deploy instrumented code
3. Submit ONE fresh test job
4. Run verification query #1 - all timestamps should populate
5. Run verification query #2 - calculate phase durations
6. Submit 5-10 more jobs
7. Run verification query #3 - establish baseline medians

## Success Criteria

- ✅ All 7 timestamps populate for successful jobs
- ✅ Timestamps follow logical ordering (no negatives)
- ✅ Can identify where jobs stall (dispatch vs claim vs Pass 1 vs Pass 2)
- ✅ Median timings established for each phase

