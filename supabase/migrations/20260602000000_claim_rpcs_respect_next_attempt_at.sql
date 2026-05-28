-- Migration: claim_rpcs_respect_next_attempt_at
-- Purpose:
--   Update claim_evaluation_jobs and claim_evaluation_job_by_id to skip jobs
--   whose next_attempt_at is in the future. This enables exponential backoff
--   on watchdog rescue: rescued jobs are re-queued with a future next_attempt_at
--   so they aren't immediately re-claimed and re-hit the same transient failure.
--
--   Jobs with NULL next_attempt_at (the common case) are always claimable.

-- ── 1. claim_evaluation_jobs ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone);

CREATE FUNCTION public.claim_evaluation_jobs(
  p_batch_size        integer,
  p_worker_id         text,
  p_lease_token       uuid,
  p_lease_expires_at  timestamp with time zone
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch integer;
  v_claim_event jsonb;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RETURN;
  END IF;

  -- Reject non-production worker IDs (probe / test patterns must not claim real jobs)
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

  v_claim_event := jsonb_build_object(
    '_type',     'claim_event',
    'worker_id', p_worker_id,
    'claimed_at', now(),
    'lease_until', p_lease_expires_at
  );

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.evaluation_jobs
    WHERE status = 'queued'
      AND phase_status = 'queued'
      AND phase IN ('phase_0', 'phase_1', 'phase_1a', 'phase_2', 'phase_3')
      AND (next_attempt_at IS NULL OR next_attempt_at <= now())
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

REVOKE ALL ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) TO authenticated;

COMMENT ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamp with time zone) IS
  'Batch claim RPC. Enforces production:<ip>:<traceId> worker_id pattern. Claimable phases: phase_0|phase_1|phase_1a|phase_2|phase_3. Respects next_attempt_at backoff. Writes lease_until. Logs claim event to progress JSONB.';

-- ── 2. claim_evaluation_job_by_id ─────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone);

CREATE FUNCTION public.claim_evaluation_job_by_id(
  p_job_id            uuid,
  p_worker_id         text,
  p_lease_token       uuid,
  p_lease_expires_at  timestamp with time zone
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_claim_event jsonb;
BEGIN
  IF p_job_id IS NULL THEN
    RETURN;
  END IF;

  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'claim_evaluation_job_by_id: worker_id cannot be null/blank';
  END IF;

  -- Reject non-production worker IDs
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

  v_claim_event := jsonb_build_object(
    '_type',     'claim_event',
    'worker_id', p_worker_id,
    'claimed_at', now(),
    'lease_until', p_lease_expires_at
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
    next_attempt_at = NULL,
    progress     = COALESCE(j.progress, '{}'::jsonb) || jsonb_build_object(
                     'claim_events',
                     COALESCE((j.progress -> 'claim_events'), '[]'::jsonb) || jsonb_build_array(v_claim_event)
                   )
  WHERE j.id = p_job_id
    AND j.status = 'queued'
    AND j.phase_status = 'queued'
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= now())
  RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) TO authenticated;

COMMENT ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamp with time zone) IS
  'Single-job claim RPC. Enforces production:<ip>:<traceId> worker_id pattern. Respects next_attempt_at backoff. Writes lease_until. Logs claim event to progress JSONB.';
