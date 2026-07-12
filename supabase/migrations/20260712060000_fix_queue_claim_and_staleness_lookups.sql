-- =============================================================================
-- Migration: Fix queue staleness/claim eligibility to use last-activity timestamp
-- Date: 2026-07-12
--
-- Problem:
--   claim_evaluation_jobs, claim_evaluation_job_by_id, and kill_stale_evaluation_jobs
--   were filtering on evaluation_jobs.created_at. This is wrong for any job that has
--   been requeued (SLA auto-requeue, self-recovery, watchdog rescue) because
--   created_at is immutable while the real "freshness" signal is updated_at, which
--   is bumped by the trg_evaluation_jobs_updated_at trigger on every state update.
--
-- Effect:
--   - Requeued jobs could not be claimed again (created_at too old) so the queue
--     silently stalled while the worker kept running.
--   - Requeued jobs were killed by kill_stale_evaluation_jobs for the same reason.
--   - terminalizeQueuedHardStops() auto-requeued, then the next cron killed the job,
--     producing PIPELINE_GLOBAL_SLA_EXCEEDED and the 83% failure rate.
--
-- Fix: use updated_at for the wall-clock/runtime guard. created_at remains on the
-- row for audit only.
-- =============================================================================

-- ── claim_evaluation_jobs (batch) ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone, integer, integer);

CREATE FUNCTION public.claim_evaluation_jobs(
  p_batch_size           integer,
  p_worker_id            text,
  p_lease_token          uuid,
  p_lease_expires_at     timestamp with time zone,
  p_max_runtime_minutes  integer DEFAULT 75,
  p_max_retries_allowed  integer DEFAULT 8
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch integer;
  v_claim_event jsonb;
  v_max_runtime_minutes integer;
  v_max_retries_allowed integer;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RETURN;
  END IF;

  IF p_worker_id NOT LIKE 'production:%' THEN
    RAISE EXCEPTION 'claim_evaluation_jobs: worker_id "%" rejected — must match production:<ip>:<traceId> pattern',
      p_worker_id;
  END IF;

  IF p_lease_token IS NULL THEN
    RETURN;
  END IF;

  IF p_lease_expires_at IS NULL THEN
    RETURN;
  END IF;

  v_batch := GREATEST(1, LEAST(COALESCE(p_batch_size, 5), 5));
  v_max_runtime_minutes := GREATEST(1, LEAST(COALESCE(p_max_runtime_minutes, 75), 1440));
  v_max_retries_allowed := GREATEST(0, LEAST(COALESCE(p_max_retries_allowed, 8), 100));

  v_claim_event := jsonb_build_object(
    '_type',     'claim_event',
    'worker_id', p_worker_id,
    'claimed_at', now(),
    'lease_until', p_lease_expires_at,
    'max_runtime_minutes', v_max_runtime_minutes,
    'max_retries_allowed', v_max_retries_allowed
  );

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.evaluation_jobs
    WHERE status = 'queued'
      AND phase_status = 'queued'
      AND completed_at IS NULL
      AND phase IN ('phase_0', 'phase_1', 'phase_1a', 'phase_2', 'phase_3')
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
      AND updated_at >= now() - make_interval(mins => v_max_runtime_minutes)
      AND COALESCE(retry_count, 0) < v_max_retries_allowed
      AND NOT (COALESCE(progress, '{}'::jsonb) ? '_admin_stop')
    ORDER BY created_at ASC
    LIMIT v_batch
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.evaluation_jobs j
  SET
    status       = 'running',
    phase_status = 'running',
    claimed_by   = p_worker_id,
    claimed_at   = now(),
    lease_token  = p_lease_token,
    lease_until  = p_lease_expires_at,
    updated_at   = now(),
    worker_pulse_at = now(),
    next_attempt_at = NULL,
    progress     = COALESCE(j.progress, '{}'::jsonb) || jsonb_build_object(
                     'claim_events',
                     COALESCE((j.progress -> 'claim_events'), '[]'::jsonb) || jsonb_build_array(v_claim_event)
                   )
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone, integer, integer) IS
  'Batch claim RPC. Atomically rejects completed, admin-stopped, over-deadline, over-retry, and backoff-ineligible jobs before claiming. Eligibility is based on updated_at, not created_at, so requeued jobs can be reclaimed.';

-- ── claim_evaluation_job_by_id (single-job) ─────────────────────────────────
DROP FUNCTION IF EXISTS public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer);

CREATE FUNCTION public.claim_evaluation_job_by_id(
  p_job_id               uuid,
  p_worker_id            text,
  p_lease_token          uuid,
  p_lease_expires_at     timestamp with time zone,
  p_max_runtime_minutes  integer DEFAULT 75,
  p_max_retries_allowed  integer DEFAULT 8
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claim_event jsonb;
  v_max_runtime_minutes integer;
  v_max_retries_allowed integer;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: worker_id cannot be null/blank';
  END IF;

  IF p_worker_id NOT LIKE 'production:%' THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: worker_id "%" rejected — must match production:<ip>:<traceId> pattern',
      p_worker_id;
  END IF;

  IF p_lease_token IS NULL THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: lease_token cannot be null';
  END IF;

  IF p_lease_expires_at IS NULL THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: lease_expires_at cannot be null';
  END IF;

  v_max_runtime_minutes := GREATEST(1, LEAST(COALESCE(p_max_runtime_minutes, 75), 1440));
  v_max_retries_allowed := GREATEST(0, LEAST(COALESCE(p_max_retries_allowed, 8), 100));

  v_claim_event := jsonb_build_object(
    '_type',     'claim_event',
    'worker_id', p_worker_id,
    'claimed_at', now(),
    'lease_until', p_lease_expires_at,
    'max_runtime_minutes', v_max_runtime_minutes,
    'max_retries_allowed', v_max_retries_allowed
  );

  RETURN QUERY
  UPDATE public.evaluation_jobs j
  SET
    status       = 'running',
    phase_status = 'running',
    claimed_by   = p_worker_id,
    claimed_at   = now(),
    lease_token  = p_lease_token,
    lease_until  = p_lease_expires_at,
    updated_at   = now(),
    worker_pulse_at = now(),
    next_attempt_at = NULL,
    progress     = COALESCE(j.progress, '{}'::jsonb) || jsonb_build_object(
                     'claim_events',
                     COALESCE((j.progress -> 'claim_events'), '[]'::jsonb) || jsonb_build_array(v_claim_event)
                   )
  WHERE j.id = p_job_id
    AND j.status = 'queued'
    AND j.phase_status = 'queued'
    AND j.completed_at IS NULL
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
    AND j.updated_at >= now() - make_interval(mins => v_max_runtime_minutes)
    AND COALESCE(j.retry_count, 0) < v_max_retries_allowed
    AND NOT (COALESCE(j.progress, '{}'::jsonb) ? '_admin_stop')
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) IS
  'Single-job claim RPC. Atomically rejects completed, admin-stopped, over-deadline, over-retry, and backoff-ineligible jobs before claiming. Eligibility is based on updated_at, not created_at.';

-- ── kill_stale_evaluation_jobs ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.kill_stale_evaluation_jobs(integer, integer);

CREATE OR REPLACE FUNCTION public.kill_stale_evaluation_jobs(
  max_runtime_minutes integer DEFAULT 75,
  max_retries_allowed integer DEFAULT 8
)
RETURNS TABLE(killed_id uuid, kill_reason text) AS $$
DECLARE
  v_max_runtime_minutes integer;
  v_max_retries_allowed integer;
BEGIN
  v_max_runtime_minutes := GREATEST(1, LEAST(COALESCE(max_runtime_minutes, 75), 1440));
  v_max_retries_allowed := GREATEST(0, LEAST(COALESCE(max_retries_allowed, 8), 100));

  RETURN QUERY
  UPDATE public.evaluation_jobs
  SET
    status = 'failed',
    completed_at = NOW(),
    last_error = '[AutoKill] ' || CASE
      WHEN retry_count >= v_max_retries_allowed
        THEN 'Retry cap exceeded (' || retry_count || '/' || v_max_retries_allowed || ' retries)'
      WHEN updated_at < NOW() - (v_max_runtime_minutes || ' minutes')::interval
        THEN 'Wall-clock timeout (' || v_max_runtime_minutes || 'min limit, last activity ' ||
             ROUND(EXTRACT(EPOCH FROM (NOW() - updated_at))/60)::text || 'min ago)'
      ELSE 'Unknown stale condition'
    END || ' killed_at=' || NOW()::text
  WHERE completed_at IS NULL
    AND status IN ('queued', 'running', 'failed', 'retrying')
    AND (
      retry_count >= v_max_retries_allowed
      OR updated_at < NOW() - (v_max_runtime_minutes || ' minutes')::interval
    )
  RETURNING id, last_error;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.kill_stale_evaluation_jobs(integer, integer) TO service_role;

COMMENT ON FUNCTION public.kill_stale_evaluation_jobs(integer, integer) IS
  'Kills jobs that have had no activity for max_runtime_minutes OR have exceeded the retry cap. Uses updated_at (not created_at) so SLA auto-requeue/self-recovery/rescue reset the staleness clock.';
