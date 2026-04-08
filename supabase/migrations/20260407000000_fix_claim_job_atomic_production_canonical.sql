
-- Emergency production fix: Restore canonical claim_job_atomic
-- Date: 2026-04-07
-- Issue: Two broken overloads setting non-canonical 'processing' status
--        Fresh jobs stuck in queued, worker unable to claim
--        Root cause: Feb 15 migration used 'processing' instead of 'running'
--
-- Fix:
-- 1. Drop both broken overloads
-- 2. Create single canonical function with correct 'running' status
-- 3. Honor JOB_CONTRACT_v1: queued → running only

-- Drop all existing overloads to avoid signature ambiguity
DROP FUNCTION IF EXISTS public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.claim_job_atomic(INTEGER, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.claim_job_atomic(TEXT, TIMESTAMPTZ, TEXT);

-- Canonical claim_job_atomic: production-ready
-- Parameters: worker_id (TEXT), now (TIMESTAMPTZ), lease_seconds (INTEGER)
-- Returns: Claimed job with correct canonical 'running' status
CREATE OR REPLACE FUNCTION public.claim_job_atomic(
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
    -- Contract §1: Validate input
    IF p_worker_id IS NULL OR p_worker_id = '' THEN
        RETURN; -- No worker provided
    END IF;

    -- TTL clamping: min 30s, max 900s (prevents tight loops or excessive leases)
    v_clamped_ttl := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 900));

    -- Contract §2: Find first eligible queued job (FIFO by created_at)
    -- Atomic claim via FOR UPDATE SKIP LOCKED
    SELECT j.id INTO v_job_id
    FROM public.evaluation_jobs j
    WHERE j.status = 'queued'
      AND (j.lease_until IS NULL OR j.lease_until < p_now)
      AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
    ORDER BY j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If no eligible job found, return empty result set
    IF v_job_id IS NULL THEN
        RETURN;
    END IF;

    -- Contract §3: Transition queued → running (canonical status value)
    -- CAS guard: only update if job still in queued state
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

    -- Contract §4: Return claimed job data for worker
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

-- Verify function signature
COMMENT ON FUNCTION public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) IS
  'Atomic job claiming per JOB_CONTRACT_v1 §5.1. Transition: queued → running. TLS clamped 30-900s. Returns claimed job or empty.';
