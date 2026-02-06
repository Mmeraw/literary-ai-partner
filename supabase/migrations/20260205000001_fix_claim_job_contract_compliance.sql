-- Fix claim_job_atomic: Only claim queued jobs (no resurrection)
-- Date: 2026-02-05
-- Contract: JOB_CONTRACT_v1 §5.1 - terminal statuses cannot transition
--
-- CRITICAL FIX: Remove 'failed' from claimable statuses
--
-- Before: WHERE j.status IN ('queued', 'failed')  -- allowed resurrection
-- After:  WHERE j.status = 'queued'               -- contract-compliant
--
-- Retries now work via retry-as-new-job pattern (separate migration).

-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_worker_id TEXT,
  p_now TIMESTAMPTZ,
  p_lease_seconds INTEGER
)
RETURNS TABLE (
  id UUID,
  manuscript_id BIGINT,
  job_type TEXT,
  policy_family TEXT,
  voice_preservation_level TEXT,
  english_variant TEXT,
  work_type TEXT,
  phase TEXT
)
LANGUAGE plpgsql
AS $claim_job_atomic$
DECLARE
  v_job_id UUID;
BEGIN
  -- JOB_CONTRACT_v1 §5.1: Only claim queued jobs.
  -- Failed jobs are TERMINAL (§3.2) and cannot transition to running.
  -- Retries must create NEW jobs (retry-as-new-job pattern).
  SELECT j.id INTO v_job_id
  FROM public.evaluation_jobs j
  WHERE j.status = 'queued'  -- FIXED: removed 'failed' (was resurrection)
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  -- JOB_CONTRACT_v1 §5.1: queued → running (allowed).
  -- CAS guard: only transition if still queued.
  UPDATE public.evaluation_jobs
  SET
    status = 'running',
    worker_id = p_worker_id,
    lease_token = gen_random_uuid(),
    lease_until = p_now + make_interval(secs => p_lease_seconds),
    heartbeat_at = p_now,
    started_at = COALESCE(started_at, p_now),
    updated_at = p_now,
    next_attempt_at = NULL
  WHERE evaluation_jobs.id = v_job_id
    AND evaluation_jobs.status = 'queued';

  RETURN QUERY
  SELECT
    j.id AS id,
    j.manuscript_id AS manuscript_id,
    j.job_type AS job_type,
    j.policy_family AS policy_family,
    j.voice_preservation_level AS voice_preservation_level,
    j.english_variant AS english_variant,
    j.work_type AS work_type,
    j.phase AS phase
  FROM public.evaluation_jobs j
  WHERE j.id = v_job_id;
END;
$claim_job_atomic$;
