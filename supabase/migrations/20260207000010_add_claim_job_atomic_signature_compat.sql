-- A4: claim_job_atomic PostgREST signature compatibility shim
-- Date: 2026-02-07
-- Purpose: PostgREST schema cache / smoke test expects:
--   claim_job_atomic(integer, timestamptz, text) signature
-- Canonical implementation signature is:
--   claim_job_atomic(p_worker_id text, p_now timestamptz, p_lease_seconds integer)
-- This wrapper preserves canonical implementation while exposing the expected signature.
-- Note: Uses c_* prefix (compat convention) to avoid named-arg ambiguity with canonical.
-- GOVERNANCE: Do not rename parameters across migrations. See GOV_CLOSEOUT_A4_COMPAT_CONTRACTS.md

CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  c_lease_seconds INTEGER,
  c_now TIMESTAMPTZ,
  c_worker_id TEXT
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
  -- Delegate to canonical implementation (p_worker_id, p_now, p_lease_seconds).
  -- Use positional args in canonical order to resolve correct overload.
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    c_worker_id,      -- First positional arg
    c_now,            -- Second positional arg
    c_lease_seconds   -- Third positional arg
  );
END;
$claim_job_atomic_compat$;
