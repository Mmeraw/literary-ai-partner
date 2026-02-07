-- Recreate compat claim_job_atomic overload with c_* parameter names
-- Date: 2026-02-07
-- Purpose: Ensure compat overload (integer, timestamptz, text) is completely distinct
--          from canonical's parameter naming so PostgREST named-arg RPC calls resolve
--          deterministically to canonical. Positional callers still work via signature match.
--
-- Critical: Use c_* prefix (not p_*) so JSON payload keys {p_worker_id, p_now, p_lease_seconds}
--          will ONLY match canonical, never the compat overload.

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
  -- Uses positional args, not named args, to avoid any overload confusion.
  -- Parameter order: c_worker_id, c_now, c_lease_seconds
  --                  must map to canonical's:
  --                  p_worker_id, p_now, p_lease_seconds
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    c_worker_id,
    c_now,
    c_lease_seconds
  );
END;
$claim_job_atomic_compat$;
