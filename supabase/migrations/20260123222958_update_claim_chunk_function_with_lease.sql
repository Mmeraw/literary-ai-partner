-- Migration: Update claim_chunk_for_processing to support lease-based recovery
-- Date: 2026-01-23
-- Purpose: Replace the old 1-parameter function with a 3-parameter version that sets lease fields

-- Drop the old function signature
DROP FUNCTION IF EXISTS public.claim_chunk_for_processing(uuid);

-- Create the updated function with lease parameters
CREATE OR REPLACE FUNCTION public.claim_chunk_for_processing(
  p_chunk_id uuid,
  p_worker_id uuid,
  p_lease_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  -- Atomically update chunk status to processing with lease
  -- Eligible cases:
  --   1. status = 'pending'
  --   2. status = 'failed' AND attempt_count < max_attempts
  --   3. status = 'processing' AND lease_expires_at <= now() (stuck/expired)
  -- Hard "no" cases:
  --   - status = 'done'
  --   - attempt_count >= max_attempts
  UPDATE public.manuscript_chunks
  SET
    status = 'processing',
    lease_id = p_worker_id,
    lease_expires_at = now() + make_interval(secs => p_lease_seconds),
    processing_started_at = now(),
    attempt_count = attempt_count + 1,
    last_error = NULL,
    updated_at = now()
  WHERE
    id = p_chunk_id
    -- Hard "no" conditions
    AND status != 'done'
    AND attempt_count < COALESCE(max_attempts, 999999)
    -- Eligible conditions (at least one must be true)
    AND (
      status = 'pending'
      OR (status = 'failed' AND attempt_count < COALESCE(max_attempts, 999999))
      OR (status = 'processing' AND lease_expires_at IS NOT NULL AND lease_expires_at <= now())
    )
  ;
  
  -- Get the number of rows updated
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Return true if exactly one row was updated
  RETURN rows_updated = 1;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer) TO anon;
