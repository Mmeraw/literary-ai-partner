-- Migration: Fix evaluation_artifacts.job_id type to match evaluation_jobs.id
-- Date: 2026-01-24
-- Purpose: Type safety and foreign key integrity

-- Note: evaluation_jobs.id is TEXT (not UUID) in current schema
-- Verify with: SELECT data_type FROM information_schema.columns WHERE table_name='evaluation_jobs' AND column_name='id';

-- If evaluation_jobs.id is TEXT, no change needed
-- If evaluation_jobs.id is UUID, uncomment below:

-- ALTER TABLE public.evaluation_artifacts
--   ALTER COLUMN job_id TYPE UUID USING job_id::uuid;

-- For now, keep as TEXT to match evaluation_jobs.id type
-- Add comment to document expected type
COMMENT ON COLUMN public.evaluation_artifacts.job_id IS 
  'Foreign key to evaluation_jobs.id (TEXT). Must match the job that produced this artifact.';
