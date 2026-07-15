-- Atomic Phase 0 → Phase 1A handoff guarded by mandatory seed artifacts.
-- The transition is the integrity boundary: phase_1a / queued with
-- phase0_completed_at may only be written after required seeds and a non-blocked
-- fit-gap report are persisted for the job.

CREATE OR REPLACE FUNCTION public.complete_phase0_to_phase1a_handoff(
  p_job_id uuid,
  p_expected_claimed_by text DEFAULT NULL,
  p_expected_lease_token uuid DEFAULT NULL,
  p_progress_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.evaluation_artifacts a
    WHERE a.job_id = p_job_id
      AND a.artifact_type = 'story_map_seed_v1'
      AND a.content IS NOT NULL
      AND a.content <> '{}'::jsonb
  ) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.evaluation_artifacts a
    WHERE a.job_id = p_job_id
      AND a.artifact_type = 'evaluation_seed_v1'
      AND a.content IS NOT NULL
      AND a.content <> '{}'::jsonb
  ) THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.evaluation_artifacts a
    WHERE a.job_id = p_job_id
      AND a.artifact_type = 'seed_fit_gap_report_v1'
      AND a.content IS NOT NULL
      AND a.content <> '{}'::jsonb
      AND COALESCE(a.content ->> 'status', '') <> 'blocked'
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.evaluation_jobs j
  SET
    status = 'queued',
    phase = 'phase_1a',
    phase_status = 'queued',
    phase0_completed_at = v_now,
    claimed_by = NULL,
    claimed_at = NULL,
    lease_token = NULL,
    lease_until = NULL,
    last_heartbeat_at = NULL,
    last_heartbeat = NULL,
    worker_pulse_at = NULL,
    updated_at = v_now,
    progress = COALESCE(j.progress, '{}'::jsonb)
      || p_progress_patch
      || jsonb_build_object(
        'phase', 'phase_1a',
        'phase_status', 'queued',
        'phase0_completed_at', v_now,
        'total_units', COALESCE(j.total_units, 100),
        'completed_units', GREATEST(COALESCE(j.completed_units, 0), 8),
        'progress_high_water', GREATEST(COALESCE(j.completed_units, 0), 8)
      )
  WHERE j.id = p_job_id
    AND j.phase = 'phase_0'
    AND j.status = 'running'
    AND j.phase_status = 'running'
    AND (p_expected_claimed_by IS NULL OR j.claimed_by = p_expected_claimed_by)
    AND (p_expected_lease_token IS NULL OR j.lease_token = p_expected_lease_token);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_phase0_to_phase1a_handoff(uuid, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_phase0_to_phase1a_handoff(uuid, text, uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.complete_phase0_to_phase1a_handoff(uuid, text, uuid, jsonb) IS
  'Atomically advances a running phase_0 evaluation to phase_1a/queued only after story_map_seed_v1, evaluation_seed_v1, and a non-blocked seed_fit_gap_report_v1 are persisted.';