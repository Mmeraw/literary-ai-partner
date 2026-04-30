-- RCA-JOB-LIFECYCLE-001 — Recovery for orphaned running jobs
-- Fixes Class D (recovery gap)

CREATE OR REPLACE FUNCTION repair_orphaned_running_jobs()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  repaired_count integer;
BEGIN
  UPDATE evaluation_jobs
  SET
    status = 'queued',
    phase_status = 'queued',
    claimed_by = NULL,
    lease_token = NULL,
    lease_until = NULL,
    last_error = COALESCE(last_error, '') || ' | repaired_orphaned_running'
  WHERE
    status = 'running'
    AND (
      claimed_by IS NULL
      OR lease_token IS NULL
      OR lease_until IS NULL
    );

  GET DIAGNOSTICS repaired_count = ROW_COUNT;
  RETURN repaired_count;
END;
$$;
