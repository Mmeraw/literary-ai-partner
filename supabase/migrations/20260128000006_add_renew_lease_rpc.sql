-- Migration: Add RPC for lease renewal with token verification
-- Phase 2D Slice 3: Heartbeat renewal safety

-- Drop all possible overloads to ensure clean slate
DROP FUNCTION IF EXISTS public.renew_lease(UUID, TEXT, UUID, TIMESTAMPTZ, INTEGER);
DROP FUNCTION IF EXISTS public.renew_lease(UUID, INTEGER, UUID, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.renew_lease(UUID, TEXT, TEXT, TIMESTAMPTZ, INTEGER);

CREATE FUNCTION public.renew_lease(
  p_job_id UUID,
  p_worker_id TEXT,
  p_lease_token UUID,
  p_now TIMESTAMPTZ,
  p_lease_seconds INTEGER
)
RETURNS TABLE (
  success BOOLEAN,
  new_lease_until TIMESTAMPTZ,
  new_heartbeat_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_token UUID;
  v_new_lease_until TIMESTAMPTZ;
BEGIN
  -- Verify lease token matches (prevents lease theft)
  SELECT lease_token INTO v_current_token
  FROM public.evaluation_jobs
  WHERE id = p_job_id
    AND worker_id = p_worker_id
    AND status = 'running'
  FOR UPDATE;

  IF v_current_token IS NULL OR v_current_token != p_lease_token THEN
    -- Token mismatch or job not found/not running
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Renew lease
  v_new_lease_until := p_now + make_interval(secs => p_lease_seconds);

  UPDATE public.evaluation_jobs
  SET
    lease_until = v_new_lease_until,
    heartbeat_at = p_now,
    updated_at = p_now
  WHERE id = p_job_id
    AND status = 'running'
    AND worker_id = p_worker_id
    AND lease_token = p_lease_token;

  RETURN QUERY SELECT 
    TRUE AS success,
    v_new_lease_until AS new_lease_until,
    p_now AS new_heartbeat_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.renew_lease(UUID, TEXT, UUID, TIMESTAMPTZ, INTEGER) TO service_role;

COMMENT ON FUNCTION renew_lease IS
  'Phase 2D Slice 3: Renew job lease with token verification. Prevents lease theft by requiring matching lease_token.';
