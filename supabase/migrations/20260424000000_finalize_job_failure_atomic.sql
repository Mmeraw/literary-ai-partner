-- Migration: Atomic failure finalization RPC
-- Purpose: Centralized, atomic failure update with retry classification
-- Scope: Worker failure finalization path

CREATE OR REPLACE FUNCTION public.finalize_job_failure_atomic(
  p_job_id uuid,
  p_failure_code text,
  p_error_message text,
  p_retryable boolean
)
RETURNS table (
  attempt_count int,
  max_attempts int,
  notified_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Single atomic UPDATE with retry classification
  -- This is the canonical failure finalization path
  
  RETURN QUERY
  UPDATE public.evaluation_jobs AS j
  SET
    attempt_count = attempt_count + 1,
    last_error = p_error_message,
    failure_code = p_failure_code,
    failed_at = v_now,
    updated_at = v_now,
    status = 'failed',
    phase_status = 'failed',
    next_attempt_at = CASE
      WHEN p_retryable = true
       AND (attempt_count + 1) < max_attempts
      THEN v_now + interval '30 seconds'
      ELSE NULL
    END
  WHERE id = p_job_id
    AND status IN ('queued', 'running')
  RETURNING j.attempt_count, j.max_attempts, j.notified_at;
END;
$$;

DO $guard$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic FROM PUBLIC;
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN undefined_object  THEN NULL;
END $guard$;

DO $guard$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic FROM authenticated;
EXCEPTION
  WHEN undefined_function THEN NULL;
  WHEN undefined_object  THEN NULL;
END $guard$;

GRANT EXECUTE ON FUNCTION public.finalize_job_failure_atomic TO service_role;
