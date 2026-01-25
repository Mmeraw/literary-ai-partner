-- Migration: Canonicalize evaluation_jobs.id as UUID with FK enforcement
-- Date: 2026-01-25
-- Purpose: Convert TEXT job IDs to UUID, add foreign keys, prevent orphans

-- ==============================================================================
-- PREFLIGHT: Detect problems that would cause FK constraint failures
-- ==============================================================================

-- Count non-UUID TEXT ids in evaluation_jobs (case-insensitive)
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM public.evaluation_jobs
  WHERE id IS NULL
     OR id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Preflight FAILED: % evaluation_jobs rows have non-UUID ids', invalid_count;
  END IF;
  
  RAISE NOTICE 'Preflight: % evaluation_jobs rows with non-UUID ids (OK)', invalid_count;
END $$;

-- Count orphan artifacts (job_id not in evaluation_jobs) - safe for mixed TEXT/UUID
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.evaluation_artifacts a
  WHERE NOT EXISTS (
    SELECT 1 
    FROM public.evaluation_jobs j 
    WHERE j.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND j.id::uuid = a.job_id
  );
  
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Preflight FAILED: % evaluation_artifacts rows are orphans (job_id not in evaluation_jobs)', orphan_count;
  END IF;
  
  RAISE NOTICE 'Preflight: % orphan evaluation_artifacts (OK)', orphan_count;
END $$;

-- Count orphan chunks (job_id not in evaluation_jobs or NULL) - safe for mixed TEXT/UUID
DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.manuscript_chunks c
  WHERE c.job_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 
      FROM public.evaluation_jobs j 
      WHERE j.id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND j.id::uuid = c.job_id
    );
  
  IF orphan_count > 0 THEN
    RAISE EXCEPTION 'Preflight FAILED: % manuscript_chunks rows are orphans (job_id not in evaluation_jobs)', orphan_count;
  END IF;
  
  RAISE NOTICE 'Preflight: % orphan manuscript_chunks (OK)', orphan_count;
END $$;

-- ==============================================================================
-- STEP 1: Two-column swap for evaluation_jobs.id (TEXT -> UUID)
-- ==============================================================================

-- Add new UUID column
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS id_uuid UUID;

-- Backfill: convert existing TEXT ids to UUID
UPDATE public.evaluation_jobs
SET id_uuid = id::uuid
WHERE id_uuid IS NULL;

-- Archive old TEXT id
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS id_text_legacy TEXT;

UPDATE public.evaluation_jobs
SET id_text_legacy = id
WHERE id_text_legacy IS NULL;

-- Drop old id column
ALTER TABLE public.evaluation_jobs
  DROP COLUMN id;

-- Rename id_uuid to id
ALTER TABLE public.evaluation_jobs
  RENAME COLUMN id_uuid TO id;

-- Make id PRIMARY KEY with default
ALTER TABLE public.evaluation_jobs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN id SET NOT NULL;

-- Re-add primary key constraint
ALTER TABLE public.evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_pkey;

ALTER TABLE public.evaluation_jobs
  ADD CONSTRAINT evaluation_jobs_pkey PRIMARY KEY (id);

-- ==============================================================================
-- STEP 2: Add foreign key constraints
-- ==============================================================================

-- FK: evaluation_artifacts.job_id -> evaluation_jobs.id
ALTER TABLE public.evaluation_artifacts
  DROP CONSTRAINT IF EXISTS fk_evaluation_artifacts_job_id;

ALTER TABLE public.evaluation_artifacts
  ADD CONSTRAINT fk_evaluation_artifacts_job_id
    FOREIGN KEY (job_id)
    REFERENCES public.evaluation_jobs(id)
    ON DELETE CASCADE;

-- FK: manuscript_chunks.job_id -> evaluation_jobs.id
ALTER TABLE public.manuscript_chunks
  DROP CONSTRAINT IF EXISTS fk_manuscript_chunks_job_id;

ALTER TABLE public.manuscript_chunks
  ADD CONSTRAINT fk_manuscript_chunks_job_id
    FOREIGN KEY (job_id)
    REFERENCES public.evaluation_jobs(id)
    ON DELETE CASCADE;

-- ==============================================================================
-- STEP 3: Update indexes referencing old TEXT id
-- ==============================================================================

-- Recreate any indexes that depended on the id column type
REINDEX TABLE public.evaluation_jobs;

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration complete: evaluation_jobs.id is now UUID with gen_random_uuid() default';
  RAISE NOTICE 'Foreign keys added: evaluation_artifacts.job_id and manuscript_chunks.job_id -> evaluation_jobs.id';
END $$;
