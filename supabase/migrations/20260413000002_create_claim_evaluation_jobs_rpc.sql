-- Migration: claim_evaluation_jobs RPC
-- Date: 2026-04-13
-- Purpose: Atomic batch job claiming for the processor worker using FOR UPDATE SKIP LOCKED
--
-- Contract (JOB_CONTRACT_v1 §5):
--   Transition: queued -> running
--   Sets: claimed_by, claimed_at, lease_expires_at, status='running'
--   Invariants: phase_status=queued -> phase_status=running
--   Lease TTL: clamped to [30, 180] seconds

CREATE OR REPLACE FUNCTION public.claim_evaluation_jobs(
  p_worker_id  TEXT,
  p_batch_size INTEGER DEFAULT 5,
  p_lease_secs INTEGER DEFAULT 180
)
RETURNS TABLE (
  id               UUID,
  phase            TEXT,
  phase_status     TEXT,
  claimed_by       TEXT,
  claimed_at       TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clamped_ttl INTEGER;
  v_batch       INTEGER;
  v_now         TIMESTAMPTZ;
BEGIN
  -- Guard: require a non-empty worker ID
  IF p_worker_id IS NULL OR p_worker_id = '' THEN
    RETURN;
  END IF;

  v_now         := now();
  v_clamped_ttl := GREATEST(30, LEAST(COALESCE(p_lease_secs, 180), 180));
  v_batch       := GREATEST(1, LEAST(COALESCE(p_batch_size, 5), 25));

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
    FROM public.evaluation_jobs j
    WHERE j.status        = 'queued'
      AND j.phase_status  = 'queued'
      AND j.phase        IN ('phase_1', 'phase_2')
    ORDER BY j.created_at ASC
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.evaluation_jobs j
    SET
      status           = 'running',
      phase_status     = 'running',
      claimed_by       = p_worker_id,
      claimed_at       = v_now,
      lease_expires_at = v_now + make_interval(secs => v_clamped_ttl),
      updated_at       = v_now
    FROM candidates
    WHERE j.id = candidates.id
    RETURNING
      j.id,
      j.phase,
      j.phase_status,
      j.claimed_by,
      j.claimed_at,
      j.lease_expires_at
  )
  SELECT
    c.id,
    c.phase,
    c.phase_status,
    c.claimed_by,
    c.claimed_at,
    c.lease_expires_at
  FROM claimed c;
END;
$$;

-- Revoke public access; grant only to service_role (processor runs as service_role)
REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_jobs(TEXT, INTEGER, INTEGER) IS
  'PR B: Atomic batch job claiming for the evaluation processor. Uses FOR UPDATE SKIP LOCKED to prevent races. '
  'Transitions queued->running in one statement. Lease TTL clamped 30-180s. Returns claimed rows.';
