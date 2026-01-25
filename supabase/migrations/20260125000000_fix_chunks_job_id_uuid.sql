-- Migration: Convert manuscript_chunks.job_id to uuid type
-- Date: 2026-01-25
-- Purpose: Fix schema mismatch - job_id should be uuid, not text

-- Ensure column exists (might be text or might not exist)
ALTER TABLE public.manuscript_chunks
  ADD COLUMN IF NOT EXISTS job_id uuid;

-- Convert text to uuid if column was text
ALTER TABLE public.manuscript_chunks
  ALTER COLUMN job_id TYPE uuid
  USING NULLIF(job_id::text, '')::uuid;

-- Create index for Phase 2 queries
CREATE INDEX IF NOT EXISTS manuscript_chunks_job_id_idx
  ON public.manuscript_chunks(job_id);

COMMENT ON COLUMN public.manuscript_chunks.job_id IS 
  'UUID linking chunk to the evaluation job that created it. Ensures Phase 2 aggregates only current job chunks.';
