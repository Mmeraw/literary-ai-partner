-- Follow-up: clear claimed_at on admin retry reset
--
-- Why:
-- admin_retry_job already clears claimed_by / lease_token / lease_until.
-- In the current lease model, claimed_at is also lease metadata and should be
-- reset with claimant fields to avoid stale lease timestamps on queued jobs.
--
-- Note:
-- lease_expires_at is intentionally not written here (generated/derived in the
-- newer claim flow).

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
  RETURN QUERY
  WITH updated AS (
    UPDATE public.evaluation_jobs j
    SET
      status          = 'queued',
      phase_status    = 'queued',
      next_attempt_at = now(),
      worker_id       = NULL,
      claimed_by      = NULL,
      claimed_at      = NULL,
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
