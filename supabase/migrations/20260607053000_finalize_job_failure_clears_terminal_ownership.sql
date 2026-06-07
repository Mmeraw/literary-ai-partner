-- Ensure terminal failure finalization cannot leave zombie ownership behind.
--
-- Incident 2026-06-07: a recovered short-form evaluation correctly terminalized
-- as failed after TEMPLATE_COMPLETENESS_GATE_FAILED, but retained claimed_by /
-- lease_token / heartbeat fields from the worker claim. Failed jobs must be
-- terminal and unowned so dashboards, watchdogs, and operators do not interpret
-- them as still running.

DO $migration$
BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS public.finalize_job_failure_atomic(uuid, text, text, boolean)';
  EXECUTE 'DROP FUNCTION IF EXISTS public.finalize_job_failure_atomic(uuid, text, text, boolean, text, text)';

  EXECUTE $fn$
    CREATE FUNCTION public.finalize_job_failure_atomic(
      p_job_id                 uuid,
      p_failure_code           text,
      p_error_message          text,
      p_retryable              boolean,
      p_expected_lease_token   text DEFAULT NULL,
      p_expected_claimed_by    text DEFAULT NULL
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
      v_guarded boolean := p_expected_lease_token IS NOT NULL AND p_expected_claimed_by IS NOT NULL;
    BEGIN
      IF (p_expected_lease_token IS NULL) <> (p_expected_claimed_by IS NULL) THEN
        RAISE EXCEPTION 'finalize_job_failure_atomic owner guard requires both expected lease token and claimant'
          USING ERRCODE = '22023';
      END IF;

      RETURN QUERY
      UPDATE public.evaluation_jobs AS j
      SET
        attempt_count     = j.attempt_count + 1,
        last_error        = p_error_message,
        failure_code      = p_failure_code,
        failed_at         = v_now,
        updated_at        = v_now,
        status            = 'failed',
        phase_status      = 'failed',
        claimed_by        = NULL,
        claimed_at        = NULL,
        lease_token       = NULL,
        lease_until       = NULL,
        last_heartbeat_at = NULL,
        last_heartbeat    = NULL,
        worker_pulse_at   = NULL,
        next_attempt_at   = CASE
          WHEN p_retryable = true
           AND (j.attempt_count + 1) < j.max_attempts
          THEN v_now + interval '30 seconds'
          ELSE NULL
        END
      WHERE j.id = p_job_id
        AND (
          (
            v_guarded = false
            AND j.status IN ('queued', 'running')
          )
          OR
          (
            v_guarded = true
            AND j.status = 'running'
            AND j.lease_token = p_expected_lease_token
            AND j.claimed_by = p_expected_claimed_by
          )
        )
      RETURNING j.attempt_count, j.max_attempts, j.notified_at;
    END;
    $finalize_job_failure_atomic$;
  $fn$;

  REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean, text, text) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean, text, text) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean, text, text) TO service_role;
END
$migration$;