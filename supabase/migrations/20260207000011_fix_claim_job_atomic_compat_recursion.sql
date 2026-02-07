-- Fix infinite recursion in claim_job_atomic compatibility wrapper
-- Date: 2026-02-07
-- Problem: Named parameters don't disambiguate PostgreSQL overloads
-- The wrapper was calling itself instead of the canonical implementation
-- Fix: Use positional arguments in canonical order (text, timestamptz, integer)

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
  -- Delegate to canonical implementation (p_worker_id, p_now, p_lease_seconds).
  -- Use positional args in canonical order to resolve correct overload.
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    p_worker_id,      -- First positional arg (TEXT)
    p_now,            -- Second positional arg (TIMESTAMPTZ)
    p_lease_seconds   -- Third positional arg (INTEGER)
  );
END;
$claim_job_atomic_compat$;
