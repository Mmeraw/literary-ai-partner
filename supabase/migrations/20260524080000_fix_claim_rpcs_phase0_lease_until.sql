-- Migration: fix_claim_rpcs_phase0_lease_until
-- Purpose:
--   1. claim_evaluation_jobs: add phase_0 to claimable phases + write lease_until (not lease_expires_at)
--   2. claim_evaluation_job_by_id: write lease_until instead of lease_expires_at (generated column)
-- Both RPCs previously wrote the generated column lease_expires_at which caused
-- "cannot assign to generated column" errors on UPDATE.

-- ── 1. claim_evaluation_jobs ─────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone);

CREATE FUNCTION public.claim_evaluation_jobs(
  p_batch_size     integer,
  p_worker_id      text,
  p_lease_token    uuid,
  p_lease_expires_at timestamp with time zone
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch INTEGER;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RETURN;
  END IF;

  IF p_lease_token IS NULL THEN
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
      AND phase IN ('phase_0', 'phase_1', 'phase_1a', 'phase_2', 'phase_3')
    ORDER BY created_at ASC
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.evaluation_jobs j
  SET
    status       = 'running',
    phase_status = 'running',
    claimed_by   = p_worker_id,
    claimed_at   = now(),
    lease_token  = p_lease_token,
    lease_until  = p_lease_expires_at,
    updated_at   = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) TO authenticated;

COMMENT ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) IS
  'Batch claim RPC. Claimable phases: phase_0 | phase_1 | phase_1a | phase_2 | phase_3. Writes lease_until (not generated lease_expires_at).';

-- ── 2. claim_evaluation_job_by_id ────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone);

CREATE FUNCTION public.claim_evaluation_job_by_id(
  p_job_id         uuid,
  p_worker_id      text,
  p_lease_token    uuid,
  p_lease_expires_at timestamp with time zone
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    status       = 'running',
    phase_status = 'running',
    claimed_by   = p_worker_id,
    claimed_at   = now(),
    lease_token  = p_lease_token,
    lease_until  = p_lease_expires_at,
    updated_at   = now()
  WHERE j.id = p_job_id
    AND j.status = 'queued'
    AND j.phase_status = 'queued'
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) IS
  'Single-job atomic claim RPC. Writes lease_until (not generated lease_expires_at). No phase restriction — caller controls which job is targeted.';
