-- Fix infinite recursion in claim_job_atomic compatibility wrapper
-- Date: 2026-02-07
-- Problem: Named parameters don't disambiguate PostgreSQL overloads
-- The wrapper was calling itself instead of the canonical implementation
-- Fix: Use positional arguments in canonical order (text, timestamptz, integer)
-- Note: Keep c_* parameters (compat convention) to avoid PostgreSQL 42P13 error

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
    c_worker_id,      -- First positional arg (TEXT)
    c_now,            -- Second positional arg (TIMESTAMPTZ)
    c_lease_seconds   -- Third positional arg (INTEGER)
  );
END;
$claim_job_atomic_compat$;
