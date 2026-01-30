-- Phase A.2: Add retry tracking to evaluation_jobs
-- Date: 2026-01-30
-- Purpose: Enable bounded retry with exponential backoff

-- Add retry tracking columns
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ NULL;

-- Add index to support "claim only ready jobs" query
-- Helps find runnable jobs fast (status=queued AND next_attempt_at<=now)
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_runnable
  ON public.evaluation_jobs (status, next_attempt_at)
  WHERE status IN ('queued', 'failed');

COMMENT ON COLUMN public.evaluation_jobs.attempt_count IS
  'Number of times this job has been attempted (includes current attempt)';

COMMENT ON COLUMN public.evaluation_jobs.max_attempts IS
  'Maximum retry attempts before marking as permanently failed';

COMMENT ON COLUMN public.evaluation_jobs.next_attempt_at IS
  'Earliest time this job can be claimed for retry (NULL = immediate)';

COMMENT ON COLUMN public.evaluation_jobs.failed_at IS
  'When the job was marked as permanently failed (after max_attempts exhausted)';

COMMENT ON INDEX public.idx_evaluation_jobs_runnable IS
  'Supports claim gate: find jobs where status=queued AND (next_attempt_at IS NULL OR next_attempt_at <= now())';
