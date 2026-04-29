-- RCA-JOB-LIFECYCLE-001 — DB invariant: running state requires claim metadata
-- Class A fix: enforce at the DB level that status='running' requires canonical claim ownership

ALTER TABLE evaluation_jobs
ADD CONSTRAINT evaluation_jobs_running_requires_claim
CHECK (
  status <> 'running'
  OR (
    claimed_by IS NOT NULL
    AND lease_token IS NOT NULL
    AND lease_until IS NOT NULL
  )
) NOT VALID;

ALTER TABLE evaluation_jobs
VALIDATE CONSTRAINT evaluation_jobs_running_requires_claim;
