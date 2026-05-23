-- Harden finalize_job_failure_atomic with optional lease-owner guards.
--
-- Compatibility contract:
-- - Existing unguarded callers may still finalize queued/running jobs by passing
--   only the original four RPC args.
-- - Guarded callers pass p_expected_lease_token + p_expected_claimed_by; then
--   the UPDATE only succeeds while the row is still running and owned by that
--   exact claim. If ownership changed, the RPC returns zero rows and the app
--   must treat that as a lost-lease/no-terminal-write outcome.

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
      v_guarded boolean := p_expected_lease_token IS NOT NULL OR p_expected_claimed_by IS NOT NULL;
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
        AND (
          (
            v_guarded = false
            AND j.status IN ('queued', 'running')
          )
          OR
          (
            v_guarded = true
            AND p_expected_lease_token IS NOT NULL
            AND p_expected_claimed_by IS NOT NULL
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
