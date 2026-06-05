-- Migration: admin_retry_job — sync progress.phase_status on retry
--
-- Root cause of STATE_SPLIT_BRAIN_DETECTED:
--   admin_retry_job sets column phase_status='queued' but does NOT update
--   progress.phase_status inside the JSONB field. When a worker previously
--   called markRunning() (setting progress.phase_status='running') and then
--   crashed, the stale progress JSONB retains 'running' while the column
--   resets to 'queued'. The watchdog's isSplitBrainState() detects this
--   divergence and fails the job — a false positive that costs users a retry.
--
-- Fix: atomically sync progress.phase_status = 'queued' in the same UPDATE.
--   Also sync progress.phase to the column value for consistency.

CREATE OR REPLACE FUNCTION public.admin_retry_job(
  p_job_id uuid,
  p_reason text default null,
  p_actor uuid default null
)
RETURNS TABLE(job_id uuid, status text, changed boolean, failure_code text)
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
      lease_token     = NULL,
      lease_until     = NULL,
      failed_at       = NULL,
      last_error      = NULL,
      updated_at      = now(),
      progress        = COALESCE(j.progress, '{}'::jsonb)
                          || jsonb_build_object(
                               'phase_status', 'queued',
                               'phase', COALESCE(j.phase, 'phase_1a'),
                               'retry_requested_at', now(),
                               'retry_reason', COALESCE(p_reason, 'admin_retry')
                             )
    WHERE
      j.id = p_job_id
      AND j.status IN ('failed', 'dead_lettered')
      AND (j.lease_until IS NULL OR j.lease_until <= now())
    RETURNING j.id, 'queued'::text AS status, j.failure_code
  )
  SELECT
    COALESCE(u.id, p_job_id)                                               AS job_id,
    COALESCE(
      u.status,
      (SELECT j2.status FROM public.evaluation_jobs j2 WHERE j2.id = p_job_id)
    )                                                                      AS status,
    (u.id IS NOT NULL)                                                     AS changed,
    (SELECT j3.failure_code FROM public.evaluation_jobs j3 WHERE j3.id = p_job_id) AS failure_code
  FROM updated u
  RIGHT JOIN (SELECT 1) one ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_retry_job(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_retry_job(uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.admin_retry_job(uuid, text, uuid) IS
  'Atomic retry RPC. Resets failed/dead_lettered jobs to queued. Now syncs progress.phase_status to prevent split-brain detection. Returns failure_code for non-transient classification.';
