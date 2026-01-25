-- Apply this SQL in Supabase SQL Editor
-- Purpose: Add evaluation_result storage to evaluation_jobs table

-- Check if columns already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'evaluation_jobs' AND column_name = 'evaluation_result'
  ) THEN
    ALTER TABLE public.evaluation_jobs
    ADD COLUMN evaluation_result JSONB NULL;
    
    COMMENT ON COLUMN public.evaluation_jobs.evaluation_result
    IS 'EvaluationResultV1 JSON payload (validated in application layer). See schemas/evaluation-result-v1.ts for structure.';
    
    RAISE NOTICE 'Added evaluation_result column';
  ELSE
    RAISE NOTICE 'evaluation_result column already exists';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'evaluation_jobs' AND column_name = 'evaluation_result_version'
  ) THEN
    ALTER TABLE public.evaluation_jobs
    ADD COLUMN evaluation_result_version TEXT NULL;
    
    COMMENT ON COLUMN public.evaluation_jobs.evaluation_result_version
    IS 'Schema version (e.g., "evaluation_result_v1"). Used to handle schema evolution.';
    
    RAISE NOTICE 'Added evaluation_result_version column';
  ELSE
    RAISE NOTICE 'evaluation_result_version column already exists';
  END IF;
END $$;

-- Create indexes (with IF NOT EXISTS protection)
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_result_verdict 
ON public.evaluation_jobs ((evaluation_result->'overview'->>'verdict'))
WHERE evaluation_result IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_has_result
ON public.evaluation_jobs (id, manuscript_id, created_at)
WHERE evaluation_result IS NOT NULL;

-- Verify
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'evaluation_jobs'
  AND column_name IN ('evaluation_result', 'evaluation_result_version')
ORDER BY column_name;
