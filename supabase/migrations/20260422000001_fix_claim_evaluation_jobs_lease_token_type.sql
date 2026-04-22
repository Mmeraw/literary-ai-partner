-- Migration: Fix lease_token type mismatch in claim_evaluation_jobs RPC
-- Date: 2026-04-22
-- Root cause: Migration 20260413000002 defined p_lease_token as TEXT, but the
--   evaluation_jobs.lease_token column is UUID (added in 20260128000001).
--   PostgreSQL raises error 42804 when assigning TEXT to a UUID column without
--   an explicit cast, causing every worker claim attempt to fail.
-- Fix: Recreate the function with p_lease_token UUID.
--   The JS caller already passes a valid UUID string (randomUUID()), so no
--   app-code changes are needed — PostgreSQL will accept the UUID input correctly.

CREATE OR REPLACE FUNCTION public.claim_evaluation_jobs(
  p_batch_size INTEGER,
  p_worker_id TEXT,
  p_lease_token UUID,
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
REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) TO service_role;

-- Drop the old TEXT overload to prevent ambiguous function resolution
DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(INTEGER, TEXT, TEXT, TIMESTAMPTZ);

COMMENT ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) IS
  'Atomic batch job claiming for the evaluation processor. Uses FOR UPDATE SKIP LOCKED to prevent races. Fixed 2026-04-22: p_lease_token changed from TEXT to UUID to match evaluation_jobs.lease_token column type (error 42804).';
