-- Phase A.4: Strengthen claim_job_atomic invariants (create)
-- Date: 2026-01-31
-- Purpose: Enforce claim eligibility gates + attempt_count monotonicity

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
  phase TEXT,
  status TEXT,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  attempt_count INTEGER,
  max_attempts INTEGER,
  next_attempt_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Claim gate:
  -- 1) status must be queued
  -- 2) lease must be expired or null
  -- 3) next_attempt_at must be null or due
  -- 4) attempt_count must be less than max_attempts
  SELECT j.id INTO v_job_id
  FROM public.evaluation_jobs j
  WHERE j.status = 'queued'
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
    AND (j.attempt_count < j.max_attempts)
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
    next_attempt_at = NULL,
    attempt_count = attempt_count + 1
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
    j.phase AS phase,
    j.status AS status,
    j.lease_token AS lease_token,
    j.lease_until AS lease_until,
    j.attempt_count AS attempt_count,
    j.max_attempts AS max_attempts,
    j.next_attempt_at AS next_attempt_at
  FROM public.evaluation_jobs j
  WHERE j.id = v_job_id;
END;
$$;
