-- Recreate compat claim_job_atomic overload with renamed parameters
-- Date: 2026-02-07
-- Purpose: avoid named-arg ambiguity while preserving positional compat signature

CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_lease_seconds_compat INTEGER,
  p_now_compat TIMESTAMPTZ,
  p_worker_id_compat TEXT
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
  -- Positional order avoids overload ambiguity.
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    p_worker_id_compat,
    p_now_compat,
    p_lease_seconds_compat
  );
END;
$claim_job_atomic_compat$;
