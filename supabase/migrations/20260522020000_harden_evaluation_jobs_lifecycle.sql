-- PR10: Harden the existing evaluation_jobs lifecycle.
--
-- Intent:
-- - Do NOT create a second queue or mutate evaluation_stage_runs.
-- - Use canonical claim/lease fields already present on evaluation_jobs:
--   worker_id, lease_token, lease_until, heartbeat_at.
-- - Enforce phase_status transitions at the DB boundary.
-- - Provide a token-checked write guard to prevent ghost writes after lease loss.

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS current_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_requested boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_phase_status_lease_until
  ON public.evaluation_jobs (phase_status, lease_until)
  WHERE phase_status IN ('queued', 'running');

CREATE OR REPLACE FUNCTION public.enforce_evaluation_job_phase_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF NEW.phase_status IS NOT DISTINCT FROM OLD.phase_status THEN
    RETURN NEW;
  END IF;

  IF OLD.phase_status IN ('complete', 'completed', 'failed', 'degraded', 'cancelled') THEN
    RAISE EXCEPTION 'CRITICAL_QUEUE_ERROR: Terminal phase_status % cannot be changed to %.', OLD.phase_status, NEW.phase_status;
  END IF;

  IF OLD.phase_status = 'queued' AND NEW.phase_status NOT IN ('running', 'cancelled') THEN
    RAISE EXCEPTION 'CRITICAL_QUEUE_ERROR: Invalid phase_status transition from queued to %.', NEW.phase_status;
  END IF;

  IF OLD.phase_status = 'running' AND NEW.phase_status NOT IN ('awaiting_approval', 'complete', 'completed', 'degraded', 'failed', 'queued', 'cancelled') THEN
    RAISE EXCEPTION 'CRITICAL_QUEUE_ERROR: Invalid phase_status transition from running to %.', NEW.phase_status;
  END IF;

  IF OLD.phase_status = 'awaiting_approval' AND NEW.phase_status NOT IN ('queued', 'complete', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'CRITICAL_QUEUE_ERROR: Invalid phase_status transition from awaiting_approval to %.', NEW.phase_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_evaluation_job_phase_status_transition ON public.evaluation_jobs;
CREATE TRIGGER trigger_enforce_evaluation_job_phase_status_transition
BEFORE UPDATE ON public.evaluation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_evaluation_job_phase_status_transition();

CREATE OR REPLACE FUNCTION public.assert_evaluation_job_lease_owner(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_found boolean;
BEGIN
  SELECT true INTO v_found
  FROM public.evaluation_jobs ej
  WHERE ej.id = p_job_id
    AND ej.worker_id = p_worker_id
    AND ej.lease_token = p_lease_token
    AND ej.phase_status = 'running'
    AND (ej.lease_until IS NULL OR ej.lease_until > now())
  LIMIT 1;

  IF COALESCE(v_found, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'CRITICAL_QUEUE_ERROR: Lease ownership check failed for job %. Ghost write rejected.', p_job_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_evaluation_job_lease_owner(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_evaluation_job_lease_owner(uuid, text, uuid) TO authenticated;
