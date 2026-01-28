-- Recreate claim_job_atomic with explicit arg order to satisfy PostgREST schema cache
DROP FUNCTION IF EXISTS claim_job_atomic(TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION claim_job_atomic(
  p_worker_id TEXT,
  p_now TIMESTAMPTZ,
  p_lease_until TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  work_type TEXT,
  phase TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT j.id INTO v_job_id
  FROM jobs j
  WHERE j.status IN ('queued', 'failed')
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE jobs
  SET
    status = 'running',
    worker_id = p_worker_id,
    lease_until = p_lease_until,
    started_at = COALESCE(started_at, p_now),
    updated_at = p_now
  WHERE jobs.id = v_job_id;

  RETURN QUERY
  SELECT j.id, j.work_type, j.phase
  FROM jobs j
  WHERE j.id = v_job_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_job_atomic(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
