-- Verify running jobs always have claim fields populated
SELECT COUNT(*) = 0 AS ok
FROM evaluation_jobs
WHERE status = 'running'
  AND (worker_id IS NULL OR lease_token IS NULL OR lease_until IS NULL);
