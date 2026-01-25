-- Migration: Add evaluation_result to evaluation_jobs
-- Date: 2026-01-25
-- Purpose: Store EvaluationResultV1 JSON payload in job record

-- Add evaluation_result column (nullable for existing jobs)
ALTER TABLE public.evaluation_jobs
ADD COLUMN evaluation_result JSONB NULL;

-- Add helpful comment for schema documentation
COMMENT ON COLUMN public.evaluation_jobs.evaluation_result
IS 'EvaluationResultV1 JSON payload (validated in application layer). See schemas/evaluation-result-v1.ts for structure.';

-- Add evaluation_result_version column for forward compatibility
ALTER TABLE public.evaluation_jobs
ADD COLUMN evaluation_result_version TEXT NULL;

COMMENT ON COLUMN public.evaluation_jobs.evaluation_result_version
IS 'Schema version (e.g., "evaluation_result_v1"). Used to handle schema evolution.';

-- Partial index for querying by verdict (only when result exists)
CREATE INDEX idx_evaluation_jobs_result_verdict 
ON public.evaluation_jobs ((evaluation_result->'overview'->>'verdict'))
WHERE evaluation_result IS NOT NULL;

-- Partial index for querying jobs with completed evaluations
CREATE INDEX idx_evaluation_jobs_has_result
ON public.evaluation_jobs (id, manuscript_id, created_at)
WHERE evaluation_result IS NOT NULL;
