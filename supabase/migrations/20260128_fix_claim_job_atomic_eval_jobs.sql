-- Migration: Align claim_job_atomic with evaluation_jobs schema
-- Ensures RPC returns the full job row needed by workers

DROP FUNCTION IF EXISTS claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER);

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
  SELECT j.id INTO v_job_id
  FROM public.evaluation_jobs j
  WHERE j.status IN ('queued', 'failed')
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
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
    last_heartbeat = p_now,
    started_at = COALESCE(started_at, p_now),
    updated_at = p_now
  WHERE id = v_job_id;

  RETURN QUERY
  SELECT j.id,
         j.manuscript_id,
         j.job_type,
         j.policy_family,
         j.voice_preservation_level,
         j.english_variant,
         j.work_type,
         j.phase
  FROM public.evaluation_jobs j
  WHERE j.id = v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
