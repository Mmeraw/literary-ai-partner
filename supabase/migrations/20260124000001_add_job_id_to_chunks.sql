-- Migration: Add job_id to manuscript_chunks for Phase-1→Phase-2 linkage
-- Date: 2026-01-24
-- Purpose: Prevent Phase 2 from aggregating chunks across different job runs

-- Add job_id column as UUID (nullable for backward compatibility with existing chunks)
ALTER TABLE public.manuscript_chunks
  ADD COLUMN IF NOT EXISTS job_id UUID NULL;

-- Add index for Phase 2 queries (filter by manuscript_id + job_id)
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_job_id 
  ON public.manuscript_chunks(job_id) 
  WHERE job_id IS NOT NULL;

-- Composite index for efficient Phase 2 queries
CREATE INDEX IF NOT EXISTS idx_manuscript_chunks_manuscript_job 
  ON public.manuscript_chunks(manuscript_id, job_id) 
  WHERE job_id IS NOT NULL;

COMMENT ON COLUMN public.manuscript_chunks.job_id IS 
  'Links chunk to the evaluation job that created it. Ensures Phase 2 aggregates only current job chunks, not stale data from previous runs. NULL for legacy chunks created before this migration.';
