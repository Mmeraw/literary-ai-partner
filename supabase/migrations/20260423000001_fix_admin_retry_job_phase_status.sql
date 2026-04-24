-- Fix admin_retry_job: set phase_status = 'queued' on retry
--
-- Root cause: admin_retry_job set status = 'queued' but did NOT set
-- phase_status = 'queued'. The live claim_evaluation_jobs predicate requires
-- BOTH fields. Retried jobs were structurally unclaimable — status looked
-- queued but phase_status was still 'failed' or 'running' from the prior run.
--
-- This migration replaces the function body with a version that:
--   1. Sets phase_status = 'queued' alongside status = 'queued'
--   2. Clears all claimant / lease fields (claimed_by, lease_token, lease_until)
--   3. Clears terminal timestamps (failed_at) and last error
--   4. Sets next_attempt_at = now() for immediate eligibility
--   5. Updates updated_at

CREATE OR REPLACE FUNCTION public.admin_retry_job(
  p_job_id uuid,
  p_reason text default null,
  p_actor uuid default null
)
RETURNS TABLE(job_id uuid, status text, changed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- p_reason and p_actor are accepted for future auditability logging.

  RETURN QUERY
  WITH updated AS (
    UPDATE public.evaluation_jobs j
    SET
      status          = 'queued',
      phase_status    = 'queued',
      next_attempt_at = now(),
      worker_id       = NULL,
      claimed_by      = NULL,
      lease_token     = NULL,
      lease_until     = NULL,
      failed_at       = NULL,
      last_error      = NULL,
      updated_at      = now()
    WHERE
      j.id = p_job_id
      AND j.status IN ('failed', 'dead_lettered')
      AND (j.lease_until IS NULL OR j.lease_until <= now())
    RETURNING j.id, 'queued'::text AS status
  )
  SELECT
    COALESCE(u.id, p_job_id)                                               AS job_id,
    COALESCE(
      u.status,
      (SELECT j2.status FROM public.evaluation_jobs j2 WHERE j2.id = p_job_id)
    )                                                                      AS status,
    (u.id IS NOT NULL)                                                     AS changed
  FROM updated u
  RIGHT JOIN (SELECT 1) one ON true;
END;
$$;
