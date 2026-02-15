-- Harden claim_job_atomic function
-- Date: 2026-02-15
-- Purpose: Add TTL clamping, SECURITY DEFINER, and search_path hardening
-- QC Gate 2 production hardening requirements

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
AS $claim_job_atomic_v3$
DECLARE
    v_job_id UUID;
    v_clamped_ttl INTEGER;
BEGIN
    -- TTL clamping: min 30s, max 900s (prevents tight claim loops or excessive leases)
    v_clamped_ttl := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 900));
    
    -- Atomic claim with FOR UPDATE SKIP LOCKED
    UPDATE public.evaluation_jobs j
    SET 
        status = 'processing',
        worker_id = p_worker_id,
        lease_token = gen_random_uuid(),
        lease_until = p_now + make_interval(secs => v_clamped_ttl),
        heartbeat_at = p_now,
        started_at = COALESCE(j.started_at, p_now)
    WHERE j.id = (
        SELECT j2.id
        FROM public.evaluation_jobs j2
        WHERE j2.status = 'queued'
          AND (j2.lease_until IS NULL OR j2.lease_until < p_now)
        ORDER BY j2.created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING j.id INTO v_job_id;
    
    -- Return the claimed job data
    RETURN QUERY
    SELECT
        j.id AS id,
        j.manuscript_id AS manuscript_id,
        j.job_type AS job_type,
        j.policy_family AS policy_family,
        j.voice_preservation_level AS voice_preservation_level,
        j.english_variant AS english_variant,
        j.work_type AS work_type,
        j.phase AS phase,
        j.status AS status,
        j.worker_id AS worker_id,
        j.lease_token AS lease_token,
        j.lease_until AS lease_until,
        j.heartbeat_at AS heartbeat_at,
        j.started_at AS started_at
    FROM public.evaluation_jobs j
    WHERE j.id = v_job_id;
END;
$claim_job_atomic_v3$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) TO service_role;
