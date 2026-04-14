
-- Emergency production fix: Restore canonical claim_job_atomic
-- Date: 2026-04-07
-- NOTE: This migration is intentionally authored as a single top-level SQL statement
-- to avoid local bootstrap failures in environments that reject multi-command prepared SQL.

DO $migration$
BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER)';
  EXECUTE 'DROP FUNCTION IF EXISTS public.claim_job_atomic(INTEGER, TIMESTAMPTZ, TEXT)';
  EXECUTE 'DROP FUNCTION IF EXISTS public.claim_job_atomic(TEXT, TIMESTAMPTZ, TEXT)';

  EXECUTE $fn$
    CREATE FUNCTION public.claim_job_atomic(
        p_worker_id TEXT,
        p_now TIMESTAMPTZ,
        p_lease_seconds INTEGER DEFAULT 300
    )
    RETURNS TABLE (
        id UUID,
        manuscript_id BIGINT,
        job_type TEXT,
        policy_family TEXT,
        voice_preservation_level TEXT,
        english_variant TEXT,
        work_type TEXT,
        phase TEXT,
        status TEXT,
        worker_id TEXT,
        lease_token UUID,
        lease_until TIMESTAMPTZ,
        heartbeat_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $claim_job_atomic_canonical$
    DECLARE
        v_job_id UUID;
        v_clamped_ttl INTEGER;
    BEGIN
        IF p_worker_id IS NULL OR p_worker_id = '' THEN
            RETURN;
        END IF;

        v_clamped_ttl := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 900));

        SELECT j.id INTO v_job_id
        FROM public.evaluation_jobs j
        WHERE j.status = 'queued'
          AND (j.lease_until IS NULL OR j.lease_until < p_now)
          AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
        ORDER BY j.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF v_job_id IS NULL THEN
            RETURN;
        END IF;

        UPDATE public.evaluation_jobs j
        SET
            status = 'running',
            worker_id = p_worker_id,
            lease_token = gen_random_uuid(),
            lease_until = p_now + make_interval(secs => v_clamped_ttl),
            heartbeat_at = p_now,
            started_at = COALESCE(j.started_at, p_now),
            updated_at = p_now,
            next_attempt_at = NULL
        WHERE j.id = v_job_id
          AND j.status = 'queued';

        RETURN QUERY
        SELECT
            j.id,
            j.manuscript_id,
            j.job_type,
            j.policy_family,
            j.voice_preservation_level,
            j.english_variant,
            j.work_type,
            j.phase,
            j.status,
            j.worker_id,
            j.lease_token,
            j.lease_until,
            j.heartbeat_at,
            j.started_at
        FROM public.evaluation_jobs j
        WHERE j.id = v_job_id;
    END;
    $claim_job_atomic_canonical$;
  $fn$;

  EXECUTE $$
    COMMENT ON FUNCTION public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) IS
      'Atomic job claiming per JOB_CONTRACT_v1 §5.1. Transition: queued -> running. TTL clamped 30-900s. Returns claimed job or empty.'
  $$;
END
$migration$;
