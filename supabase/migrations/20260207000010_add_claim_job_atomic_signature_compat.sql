-- A4: claim_job_atomic PostgREST signature compatibility shim
-- Date: 2026-02-07
-- Purpose: PostgREST schema cache / smoke test expects:
--   claim_job_atomic(p_lease_seconds int, p_now timestamptz, p_worker_id text)
-- Canonical implementation signature is:
--   claim_job_atomic(p_worker_id text, p_now timestamptz, p_lease_seconds integer)
-- This wrapper preserves canonical implementation while exposing the expected signature.

CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_lease_seconds INTEGER,
  p_now TIMESTAMPTZ,
  p_worker_id TEXT
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
AS $claim_job_atomic_compat$
BEGIN
  -- Delegate to canonical implementation using named parameters.
  -- This preserves internal contracts while satisfying PostgREST caller expectations.
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    p_worker_id := p_worker_id,
    p_now := p_now,
    p_lease_seconds := p_lease_seconds
  );
END;
$claim_job_atomic_compat$;
