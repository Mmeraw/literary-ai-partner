-- Migration: Phase 0 as a real DB phase (gold standard warm-up)
--
-- Before this migration, jobs were created at phase='phase_1a' and Phase 0
-- was a logical sub-stage inside the processor with no DB presence.
--
-- After this migration:
--   1. Jobs are created at phase='phase_0', phase_status='queued'
--   2. claim_evaluation_jobs RPC includes 'phase_0' in the phase filter
--   3. The processor executes a real Phase 0 block: loads WAVE gold standards
--      into the LLM's context window (20-30s warm-up), then transitions the
--      job to phase='phase_1a', phase_status='queued' and kicks the worker.
--
-- The evaluator STUDIES what success looks like BEFORE touching the manuscript.
-- No chunking, no manuscript read — just calibration of the judging standard.

-- ── 1. Recreate claim_evaluation_jobs to include phase_0 ─────────────────────

CREATE OR REPLACE FUNCTION public.claim_evaluation_jobs(
  p_batch_size     INTEGER,
  p_worker_id      TEXT,
  p_lease_token    UUID,
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
      AND phase IN ('phase_0', 'phase_1', 'phase_1a', 'phase_2', 'phase_3')
    ORDER BY created_at ASC
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.evaluation_jobs j
  SET
    status         = 'running',
    phase_status   = 'running',
    claimed_by     = p_worker_id,
    claimed_at     = now(),
    lease_token    = p_lease_token,
    lease_expires_at = p_lease_expires_at,
    updated_at     = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_jobs(INTEGER, TEXT, UUID, TIMESTAMPTZ) IS
  'Atomic batch job claiming. Phase filter expanded 2026-05-24 to include phase_0 (gold-standard warm-up phase).';

-- ── 2. Ensure phase_0 is in the phase CHECK constraint ───────────────────────
-- (Already present in 20260524044800 migration — this is a no-op guard.)
-- The constraint currently allows: phase_0, phase_1, phase_1a, phase_2, phase_3, review_gate, wave_revision
-- No ALTER needed; confirmed by 20260524044800_add_review_gate_to_phase_check.sql.

-- ── 3. Index hint: phase_0 jobs should be picked up fast ─────────────────────
-- The existing idx_evaluation_jobs_worker_pulse_running covers running jobs.
-- No additional index needed — the claim RPC uses the existing status+phase_status index.
