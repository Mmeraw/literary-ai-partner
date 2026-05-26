-- Migration: fix admin_reset_evaluation_job to always reset to phase_0
-- Purpose:
--   The deployed RPC was resetting jobs to phase=phase_1a when they had
--   previously run Phase 1A. Reset must always rewind to phase_0/queued
--   regardless of prior phase. This migration CREATE OR REPLACEs the
--   function with the correct reset target and additionally clears
--   started_at + completed_at so timing resets cleanly.
--
-- Notes:
--   - phase=phase_0, phase_status=queued, status=queued
--   - clears claim/lease ownership: claimed_by, lease_token, lease_until,
--     worker_pulse_at, last_heartbeat_at, last_heartbeat
--   - clears started_at, completed_at (top-level job timing)
--   - clears phase0_started_at, phase0_completed_at (phase-level)
--   - clears phase_unit_index / phase_unit_fraction inside progress JSONB
--   - resets attempt_count to 0
--   - preserves claim_events audit trail, appends a _reset_events entry
--   - lease_until is the only writable lease expiry field
--     (lease_expires_at is generated/read-only)

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

  -- Build clean initial progress: preserve claim_events, add reset audit.
  -- phase_unit_index and phase_unit_fraction are intentionally NOT set
  -- so they read back as null (clean restart).
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
    started_at           = NULL,
    completed_at         = NULL,
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
  'Full job reset to phase_0/queued from any status. Clears claim/lease ownership, started_at, completed_at, phase0_*_at, attempt_count, and progress (preserving claim_events + appending reset audit). Always rewinds to phase_0 regardless of prior phase.';
