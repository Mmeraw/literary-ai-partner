-- Migration: admin_reset_evaluation_job
-- Purpose:
--   Full reset of an evaluation job back to phase_0/queued from ANY status.
--   Used when a job must be re-run from scratch (e.g. after a deploy fixes a
--   Phase 0 calibration failure, or stale progress is polluting the UI).
--
--   Differences from admin_rescue_orphaned_evaluation_job:
--     - Works on ANY status (not just 'running')
--     - Always rewinds phase to phase_0 (full restart)
--     - Wipes progress JSONB to a clean initial state
--       (preserves claim_events audit trail, purges all failure/error fields)
--     - Clears phase0_started_at, phase0_completed_at so timestamps are fresh
--     - Resets attempt_count to 0
--
-- Caller: admin routes or manual intervention via service_role.
-- Idempotent: running twice is safe.

CREATE OR REPLACE FUNCTION public.admin_reset_evaluation_job(
  p_job_id   UUID,
  p_reason   TEXT DEFAULT 'admin_reset'
)
RETURNS TABLE (
  id              UUID,
  status          TEXT,
  phase           TEXT,
  phase_status    TEXT,
  reset_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now           TIMESTAMPTZ := now();
  v_prior_status  TEXT;
  v_prior_phase   TEXT;
  v_claim_events  JSONB;
  v_fresh_progress JSONB;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  -- Snapshot prior state and preserve claim_events audit trail
  SELECT
    j.status,
    j.phase,
    COALESCE(j.progress -> 'claim_events', '[]'::jsonb)
  INTO v_prior_status, v_prior_phase, v_claim_events
  FROM public.evaluation_jobs j
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Build clean initial progress: preserve claim_events, add reset audit
  v_fresh_progress := jsonb_build_object(
    'claim_events', v_claim_events,
    '_reset_events', jsonb_build_array(
      jsonb_build_object(
        'reset_at',       v_now,
        'reason',         COALESCE(p_reason, 'admin_reset'),
        'prior_status',   v_prior_status,
        'prior_phase',    v_prior_phase,
        'reset_by',       'admin_reset_evaluation_job'
      )
    )
  );

  RETURN QUERY
  UPDATE public.evaluation_jobs j
  SET
    status               = 'queued',
    phase                = 'phase_0',
    phase_status         = 'queued',
    claimed_by           = NULL,
    lease_token          = NULL,
    lease_until          = NULL,
    worker_pulse_at      = NULL,
    last_heartbeat_at    = NULL,
    last_heartbeat       = NULL,
    phase0_started_at    = NULL,
    phase0_completed_at  = NULL,
    attempt_count        = 0,
    next_attempt_at      = NULL,
    progress             = v_fresh_progress,
    updated_at           = v_now
  WHERE j.id = p_job_id
  RETURNING
    j.id,
    j.status,
    j.phase,
    j.phase_status,
    v_now AS reset_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_evaluation_job(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_reset_evaluation_job(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.admin_reset_evaluation_job(UUID, TEXT) IS
  'Full job reset to phase_0/queued from any status. Wipes progress (preserves claim_events + appends reset audit). Clears all timestamps and attempt_count. Use when a job must be re-run from scratch.';
