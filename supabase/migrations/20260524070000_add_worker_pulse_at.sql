-- Add worker_pulse_at as a top-level indexed column so the watchdog can
-- efficiently find jobs that are lease-alive but work-dead without a JSONB cast.
--
-- worker_pulse_at: written at every real work checkpoint (chunk completion)
-- by the processor. Distinct from last_heartbeat_at which is written by the
-- 30s lease renewal timer regardless of whether any LLM work completed.
--
-- The watchdog checks: status=running AND worker_pulse_at < NOW()-30s
-- (or worker_pulse_at IS NULL AND last_heartbeat_at < NOW()-60s for jobs
-- that pre-date this column).

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS worker_pulse_at TIMESTAMPTZ NULL;

-- Partial index: only running jobs need fast idle detection.
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_worker_pulse_running
  ON public.evaluation_jobs (worker_pulse_at)
  WHERE status = 'running';

COMMENT ON COLUMN public.evaluation_jobs.worker_pulse_at IS
  'Timestamp of the last real work checkpoint (chunk completion). Written by the processor at every chunk. Distinct from last_heartbeat_at (lease timer). Used by the watchdog to detect jobs frozen mid-LLM-call.';
