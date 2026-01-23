-- Migration: Add lease-based recovery fields to manuscript_chunks
-- Date: 2026-01-23
-- Purpose: Enable crash recovery via expired leases for distributed chunk processing

-- Add lease columns for worker coordination and crash recovery
ALTER TABLE public.manuscript_chunks
  ADD COLUMN IF NOT EXISTS lease_id uuid NULL,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS max_attempts integer NULL DEFAULT 3;

-- Index for efficient recovery queries (find stuck processing chunks)
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_recovery
  ON public.manuscript_chunks(lease_expires_at, status)
  WHERE status = 'processing' AND lease_expires_at IS NOT NULL;

-- Index for attempt limiting (find chunks at max attempts)
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_attempts
  ON public.manuscript_chunks(attempt_count, max_attempts)
  WHERE status = 'failed';

-- Comments for documentation
COMMENT ON COLUMN public.manuscript_chunks.lease_id IS 'UUID of worker currently holding the lease; enables crash detection';
COMMENT ON COLUMN public.manuscript_chunks.lease_expires_at IS 'When this lease expires; if NOW() > this and status=processing, chunk is eligible for recovery';
COMMENT ON COLUMN public.manuscript_chunks.max_attempts IS 'Maximum retry attempts; NULL = unlimited';
