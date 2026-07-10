-- =============================================================================
-- Migration: Harden claim RPC eligibility with deadline/retry/admin-stop guards
-- Date: 2026-07-10
--
-- Incident hardening:
--   - claim_evaluation_jobs and claim_evaluation_job_by_id must atomically reject
--     over-deadline or over-retry jobs inside the claim transaction.
--   - completed, administratively stopped, and not-yet-eligible jobs are never
--     claimable even if a pre-claim sweep fails or is delayed.
-- =============================================================================

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
      AND created_at >= now() - make_interval(mins => v_max_runtime_minutes)
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
  'Batch claim RPC. Atomically rejects completed, admin-stopped, over-deadline, over-retry, and backoff-ineligible jobs before claiming.';

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
    AND j.created_at >= now() - make_interval(mins => v_max_runtime_minutes)
    AND COALESCE(j.retry_count, 0) < v_max_retries_allowed
    AND NOT (COALESCE(j.progress, '{}'::jsonb) ? '_admin_stop')
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone, integer, integer) IS
  'Single-job claim RPC. Atomically rejects completed, admin-stopped, over-deadline, over-retry, and backoff-ineligible jobs before claiming.';
