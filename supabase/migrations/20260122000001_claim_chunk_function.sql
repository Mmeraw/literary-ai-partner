-- Migration: Add RPC function for atomic chunk claiming
-- Date: 2026-01-22
-- Purpose: Provide atomic conditional update for claimChunkForProcessing
-- This function is REQUIRED for production-grade concurrency safety

-- Function to atomically claim a chunk for processing
-- Returns true if the chunk was claimed, false otherwise
CREATE OR REPLACE FUNCTION public.claim_chunk_for_processing(chunk_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated integer;
BEGIN
  -- Atomically update chunk status from pending/failed to processing
  -- Only succeeds if current status is pending or failed
  -- This is the ONLY safe way to claim chunks in concurrent scenarios
  UPDATE public.manuscript_chunks
  SET
    status = 'processing',
    attempt_count = attempt_count + 1,
    last_error = NULL,
    processing_started_at = now(),
    updated_at = now()
  WHERE
    id = chunk_id
    AND status IN ('pending', 'failed')
  ;
  
  -- Get the number of rows updated
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  
  -- Return true if exactly one row was updated
  RETURN rows_updated = 1;
END;
$$;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid) TO anon;
