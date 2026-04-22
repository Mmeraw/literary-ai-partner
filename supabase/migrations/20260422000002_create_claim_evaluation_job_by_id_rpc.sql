-- Migration: create canonical single-job claim RPC for Phase 1
-- Purpose:
--   Replace legacy claim_evaluation_job_phase1 JSONB-only claim path.
--   Claim one specific queued phase_1 evaluation job using top-level contract fields.

CREATE OR REPLACE FUNCTION public.claim_evaluation_job_by_id(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_token UUID,
  p_lease_expires_at TIMESTAMPTZ
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: worker_id cannot be null/blank';
  END IF;

  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: lease_token cannot be null';
  END IF;

  IF p_lease_expires_at IS NULL THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: lease_expires_at cannot be null';
  END IF;

  RETURN QUERY
  UPDATE public.evaluation_jobs j
  SET
    status = 'running',
    phase_status = 'running',
    claimed_by = p_worker_id,
    claimed_at = now(),
    lease_token = p_lease_token,
    lease_expires_at = p_lease_expires_at,
    updated_at = now()
  WHERE j.id = p_job_id
    AND j.status = 'queued'
    AND j.phase = 'phase_1'
    AND j.phase_status = 'queued'
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_job_by_id(UUID, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(UUID, TEXT, UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_job_by_id(UUID, TEXT, UUID, TIMESTAMPTZ) IS
  'Canonical single-job atomic claim RPC for phase_1 evaluation jobs. Writes top-level claimant metadata; replaces legacy claim_evaluation_job_phase1 JSONB lease path.';