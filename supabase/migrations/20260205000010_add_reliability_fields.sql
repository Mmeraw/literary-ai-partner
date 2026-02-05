-- Phase C Week 1: Add reliability tracking fields
-- Date: 2026-02-05
-- Purpose: Enable structured failure envelopes and retry tracking for Phase C

-- Add last_attempt_at for retry policy timing
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ NULL;

-- Add failure_envelope for structured error information
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS failure_envelope JSONB NULL;

-- Add index to support retry timing queries
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_retry_timing
  ON public.evaluation_jobs (status, last_attempt_at, attempt_count)
  WHERE status IN ('queued', 'failed');

-- Add index to support failure analysis queries
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_failure_envelope
  ON public.evaluation_jobs USING GIN (failure_envelope)
  WHERE failure_envelope IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN public.evaluation_jobs.last_attempt_at IS
  'Phase C: Timestamp of the last retry attempt (NULL if never retried). Used by shouldRetry() for backoff calculation.';

COMMENT ON COLUMN public.evaluation_jobs.failure_envelope IS
  'Phase C: Structured failure information as JSONB. 
   Schema: { provider: string, error_code: string, message: string, retryable: boolean, raw_context?: any }
   Populated on all provider failures for machine-readable error analysis.';

COMMENT ON INDEX public.idx_evaluation_jobs_retry_timing IS
  'Phase C: Supports retry policy queries - find jobs eligible for retry based on timing and attempt count';

COMMENT ON INDEX public.idx_evaluation_jobs_failure_envelope IS
  'Phase C: Supports failure analysis queries using JSONB operators (e.g., WHERE failure_envelope @> ''{"retryable": false}'')';
