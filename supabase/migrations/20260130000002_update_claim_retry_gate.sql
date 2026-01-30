-- Phase A.2: Update claim_job_atomic to respect retry backoff
-- Date: 2026-01-30
-- Purpose: Prevent claiming jobs before their scheduled retry time

CREATE OR REPLACE FUNCTION claim_job_atomic(
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
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Phase A.2: Add claim gate for retry backoff
  -- Only claim jobs where:
  --   1. status IN ('queued', 'failed')
  --   2. lease is expired or null
  --   3. next_attempt_at is null OR next_attempt_at <= now (RETRY GATE)
  SELECT j.id INTO v_job_id
  FROM public.evaluation_jobs j
  WHERE j.status IN ('queued', 'failed')
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evaluation_jobs
  SET
    status = 'running',
    worker_id = p_worker_id,
    lease_token = gen_random_uuid(),
    lease_until = p_now + make_interval(secs => p_lease_seconds),
    heartbeat_at = p_now,
    started_at = COALESCE(started_at, p_now),
    updated_at = p_now,
    next_attempt_at = NULL  -- Clear retry schedule once claimed
  WHERE evaluation_jobs.id = v_job_id;

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
$$;

COMMENT ON FUNCTION claim_job_atomic IS
  'Phase A.2: Atomically claim a job for processing with retry backoff gate. ' ||
  'Only claims jobs where next_attempt_at is null or in the past.';
