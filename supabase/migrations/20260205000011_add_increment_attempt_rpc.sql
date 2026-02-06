-- Phase C Week 1: Atomic attempt count increment
-- Date: 2026-02-05
-- Purpose: Safely increment attempt_count and update last_attempt_at atomically

CREATE OR REPLACE FUNCTION public.increment_job_attempt_count(
  p_job_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.evaluation_jobs
  SET 
    attempt_count = attempt_count + 1,
    last_attempt_at = p_timestamp,
    updated_at = p_timestamp
  WHERE id = p_job_id;
  
  -- No error if job not found (idempotent)
END;
$$;

COMMENT ON FUNCTION public.increment_job_attempt_count IS
  'Phase C: Atomically increment attempt_count and update last_attempt_at for retry tracking.
   Used by IdempotentRetryCoordinator to ensure accurate retry counting.';

-- Grant execute to authenticated users (for worker processes)
GRANT EXECUTE ON FUNCTION public.increment_job_attempt_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_job_attempt_count TO service_role;
