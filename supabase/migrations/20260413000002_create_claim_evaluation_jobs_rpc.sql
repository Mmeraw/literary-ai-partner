-- Migration: claim_evaluation_jobs RPC
-- Date: 2026-04-13
-- Purpose: Atomic batch job claiming for the processor worker using FOR UPDATE SKIP LOCKED
--
-- Contract (JOB_CONTRACT_v1 §5):
--   Transition: queued -> running
--   Sets: claimed_by, claimed_at, lease_token, lease_expires_at, status='running'
--   Invariants: phase_status=queued -> phase_status=running

CREATE OR REPLACE FUNCTION public.claim_evaluation_jobs(
  p_batch_size INTEGER,
  p_worker_id TEXT,
  p_lease_token TEXT,
  p_lease_expires_at TIMESTAMPTZ
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch INTEGER;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RETURN;
  END IF;

  IF p_lease_token IS NULL OR btrim(p_lease_token) = '' THEN
    RETURN;
  END IF;

  IF p_lease_expires_at IS NULL THEN
    RETURN;
  END IF;

  v_batch := GREATEST(1, LEAST(COALESCE(p_batch_size, 5), 5));

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.evaluation_jobs
    WHERE status = 'queued'
      AND phase_status = 'queued'
      AND phase IN ('phase_1', 'phase_2')
    ORDER BY created_at ASC
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.evaluation_jobs j
  SET
    status = 'running',
    phase_status = 'running',
    claimed_by = p_worker_id,
    claimed_at = now(),
    lease_token = p_lease_token,
    lease_expires_at = p_lease_expires_at,
    updated_at = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

-- Revoke public access; grant only to service_role (processor runs as service_role)
REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, TEXT, TIMESTAMPTZ) IS
  'PR B: Atomic batch job claiming for the evaluation processor. Uses FOR UPDATE SKIP LOCKED to prevent races and updates queued->running atomically.';
