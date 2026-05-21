-- Hotfix: allow long-form evaluation jobs up to ten watchdog rescues.
--
-- IMPORTANT SEMANTICS:
-- evaluation_jobs.attempt_count is incremented on every worker claim,
-- including the initial claim. Therefore ten rescues requires eleven
-- total attempts:
--   attempt 1    = initial claim
--   attempts 2-11 = up to ten rescue/reclaim opportunities
--
-- This keeps the claim_job_atomic guard unchanged:
--   attempt_count < max_attempts
-- and only raises the per-job/default ceiling.

ALTER TABLE public.evaluation_jobs
  ALTER COLUMN max_attempts SET DEFAULT 11;

-- Protect active proof runs and queued jobs immediately after migration.
-- Terminal jobs are intentionally left untouched for audit integrity.
UPDATE public.evaluation_jobs
SET
  max_attempts = 11,
  updated_at = NOW()
WHERE status IN ('queued', 'running')
  AND COALESCE(max_attempts, 0) < 11;

COMMENT ON COLUMN public.evaluation_jobs.max_attempts IS
  'Maximum total worker claims before permanent failure. Default 11 = initial claim + up to ten watchdog rescues.';
