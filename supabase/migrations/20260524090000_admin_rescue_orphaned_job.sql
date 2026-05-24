-- Migration: admin_rescue_orphaned_evaluation_job
-- Purpose:
--   Canonical rescue function for orphaned evaluation jobs.
--
--   An orphaned job is one where:
--     - status = 'running'
--     - claimed_by or lease_token exists
--     - but the worker died before writing worker_pulse_at (null)
--       OR worker_pulse_at is stale beyond the threshold
--     - no real processing has occurred since claim
--
--   This function is the ONE authorised path for rescuing such jobs.
--   It NEVER deletes the job or the manuscript.
--   It ALWAYS appends an audit event to progress JSONB.
--   It ALWAYS preserves the current phase (no phase rewind unless explicitly passed).
--
-- Caller: admin routes, watchdog, or manual intervention via service_role.
-- Idempotent: running it twice on the same job is safe (second call finds no
--   running row and returns 0 rows).

CREATE OR REPLACE FUNCTION public.admin_rescue_orphaned_evaluation_job(
  p_job_id   UUID,
  p_reason   TEXT DEFAULT 'admin_rescue'
)
RETURNS TABLE (
  id              UUID,
  status          TEXT,
  phase           TEXT,
  phase_status    TEXT,
  rescued_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now         TIMESTAMPTZ := now();
  v_audit_event JSONB;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Build audit event to append to progress JSONB
  v_audit_event := jsonb_build_object(
    '_rescue_event', jsonb_build_object(
      'rescued_at',    v_now,
      'reason',        COALESCE(p_reason, 'admin_rescue'),
      'rescued_by',    'admin_rescue_orphaned_evaluation_job'
    )
  );

  RETURN QUERY
  UPDATE public.evaluation_jobs j
  SET
    status          = 'queued',
    phase_status    = 'queued',
    claimed_by      = NULL,
    lease_token     = NULL,
    lease_until     = NULL,
    worker_pulse_at = NULL,
    last_heartbeat_at = NULL,
    last_heartbeat  = NULL,
    -- Merge rescue audit into existing progress JSONB
    progress        = COALESCE(j.progress, '{}'::jsonb) || v_audit_event,
    updated_at      = v_now
  WHERE j.id = p_job_id
    AND j.status = 'running'          -- only rescue running rows
  RETURNING
    j.id,
    j.status,
    j.phase,
    j.phase_status,
    v_now AS rescued_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_rescue_orphaned_evaluation_job(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rescue_orphaned_evaluation_job(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.admin_rescue_orphaned_evaluation_job(UUID, TEXT) IS
  'Canonical rescue for orphaned running jobs. Clears claim/lease fields, requeues at current phase, appends audit event to progress. Never deletes. Never touches manuscripts.';
