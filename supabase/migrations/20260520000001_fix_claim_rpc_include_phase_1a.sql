-- Migration: include phase_1a (and phase_3) in claim_evaluation_jobs RPC filter
-- Date: 2026-05-20
--
-- Root cause: After commit 0f3b37c6, new evaluation jobs are created at
--   phase='phase_1a' (Pass 1A character sweep), but claim_evaluation_jobs RPC
--   only matched phase IN ('phase_1', 'phase_2'). Result: queued phase_1a jobs
--   were never claimed by the processor worker — RPC returned 200 with zero rows.
--
-- Fix: expand the WHERE clause to cover the full phase chain:
--   phase_1  → Pass 1 + Pass 2
--   phase_1a → Pass 1A character sweep
--   phase_2  → Pass 3 synthesis
--   phase_3  → WAVE revision
--
-- Note: lease_expires_at is preserved in the UPDATE here because the existing
-- RPC contract already accepts and writes it. If lease_expires_at later becomes
-- a generated column, drop the assignment in a follow-up migration.

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
      AND phase IN ('phase_1', 'phase_1a', 'phase_2', 'phase_3')
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

REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) IS
  'Atomic batch job claiming. Phase filter expanded 2026-05-20 to include phase_1a and phase_3 — without these, jobs created at phase_1a were silently ignored by the worker poll.';
