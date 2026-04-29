-- Repairs finalize_job_failure_atomic to match its original design intent
-- by adding the two columns that were referenced but never landed
-- (failure_code, notified_at), then recreating the function with the
-- canonical 3-column return shape.
--
-- NOTE: Intentionally authored as a single top-level SQL statement to avoid
-- environments that reject multi-command prepared SQL during migration apply.

DO $migration$
BEGIN
  -- 1) Add the two columns the function expects.
  EXECUTE 'ALTER TABLE public.evaluation_jobs ADD COLUMN IF NOT EXISTS failure_code text';
  EXECUTE 'ALTER TABLE public.evaluation_jobs ADD COLUMN IF NOT EXISTS notified_at timestamptz';

  -- 2) Drop previous signature before recreate (return-shape-safe across drifted envs).
  EXECUTE 'DROP FUNCTION IF EXISTS public.finalize_job_failure_atomic(uuid, text, text, boolean)';

  -- 3) Recreate with canonical 3-column return shape.
  EXECUTE $fn$
    CREATE FUNCTION public.finalize_job_failure_atomic(
      p_job_id        uuid,
      p_failure_code  text,
      p_error_message text,
      p_retryable     boolean
    )
    RETURNS TABLE (
      attempt_count int,
      max_attempts  int,
      notified_at   timestamptz
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $finalize_job_failure_atomic$
    DECLARE
      v_now timestamptz := now();
    BEGIN
      RETURN QUERY
      UPDATE public.evaluation_jobs AS j
      SET
        attempt_count   = j.attempt_count + 1,
        last_error      = p_error_message,
        failure_code    = p_failure_code,
        failed_at       = v_now,
        updated_at      = v_now,
        status          = 'failed',
        phase_status    = 'failed',
        next_attempt_at = CASE
          WHEN p_retryable = true
           AND (j.attempt_count + 1) < j.max_attempts
          THEN v_now + interval '30 seconds'
          ELSE NULL
        END
      WHERE j.id = p_job_id
        AND j.status IN ('queued', 'running')
      RETURNING j.attempt_count, j.max_attempts, j.notified_at;
    END;
    $finalize_job_failure_atomic$;
  $fn$;

  -- 4) Lock down execution to service_role only.
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean) FROM PUBLIC';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean) FROM authenticated';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean) TO service_role';
END
$migration$;
