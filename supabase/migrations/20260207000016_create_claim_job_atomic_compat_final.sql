-- Recreate compat claim_job_atomic with c_* parameters (final fix)
-- Date: 2026-02-07
-- Purpose: Compat overload uses c_* prefix so it NEVER matches named-arg RPC calls.
--          PostgREST can only resolve {p_worker_id, p_now, p_lease_seconds} to canonical.
--          Positional callers (by type/order) still resolve to compat correctly.
--
-- Contract: Named-arg RPC calls must resolve deterministically to ONE function.
--          Two overloads with identical parameter names = ambiguity.
--          Two overloads with different parameter names = no ambiguity.

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
  -- Uses positional args by type/order to avoid any ambiguity.
  -- Signature is (integer, timestamptz, text) so positional callers
  -- still correctly invoke this overload.
  RETURN QUERY
  SELECT *
  FROM public.claim_job_atomic(
    c_worker_id,
    c_now,
    c_lease_seconds
  );
END;
$claim_job_atomic_compat$;
