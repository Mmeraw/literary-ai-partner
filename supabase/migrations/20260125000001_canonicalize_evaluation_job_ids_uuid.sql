-- Migration: Canonicalize evaluation_jobs.id as UUID with FK enforcement
-- Date: 2026-01-25
-- Purpose: Convert TEXT job IDs to UUID, add foreign keys, prevent orphans

-- ==============================================================================
-- PREFLIGHT: Skip entire migration if id is already UUID
-- ==============================================================================

DO $$
DECLARE
  id_type text;
BEGIN
  -- Check current data type of id column
  SELECT data_type INTO id_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND table_name='evaluation_jobs'
    AND column_name='id';

  IF id_type = 'uuid' THEN
    RAISE NOTICE 'Skipping 20260125000001: evaluation_jobs.id already UUID.';
    RETURN;
  END IF;

  -- If we reach here, id is TEXT and needs conversion
  RAISE NOTICE 'Starting UUID migration: evaluation_jobs.id is currently TEXT';

  -- PREFLIGHT checks for TEXT->UUID conversion
  DECLARE
    invalid_count INTEGER;
    orphan_artifacts INTEGER;
    orphan_chunks INTEGER;
  BEGIN
    -- Count non-UUID TEXT ids
    SELECT COUNT(*) INTO invalid_count
    FROM public.evaluation_jobs
    WHERE id IS NULL
       OR id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    
    IF invalid_count > 0 THEN
      RAISE EXCEPTION 'Preflight FAILED: % evaluation_jobs rows have non-UUID TEXT ids', invalid_count;
    END IF;
    
    RAISE NOTICE 'Preflight: All evaluation_jobs.id are valid UUID strings';

    -- Count orphan artifacts
    SELECT COUNT(*) INTO orphan_artifacts
    FROM public.evaluation_artifacts a
    WHERE NOT EXISTS (
      SELECT 1 FROM public.evaluation_jobs j WHERE j.id = a.job_id::text
    );
    
    IF orphan_artifacts > 0 THEN
      RAISE EXCEPTION 'Preflight FAILED: % evaluation_artifacts rows are orphans', orphan_artifacts;
    END IF;

    -- Count orphan chunks
    SELECT COUNT(*) INTO orphan_chunks
    FROM public.manuscript_chunks c
    WHERE c.job_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.evaluation_jobs j WHERE j.id = c.job_id::text
      );
    
    IF orphan_chunks > 0 THEN
      RAISE EXCEPTION 'Preflight FAILED: % manuscript_chunks rows are orphans', orphan_chunks;
    END IF;

    RAISE NOTICE 'Preflight: No orphan artifacts or chunks';

    -- ==============================================================================
    -- STEP 1: Two-column swap for evaluation_jobs.id (TEXT -> UUID)
    -- ==============================================================================

    -- Add new UUID column
    ALTER TABLE public.evaluation_jobs ADD COLUMN IF NOT EXISTS id_uuid UUID;

    -- Backfill: convert existing TEXT ids to UUID
    UPDATE public.evaluation_jobs SET id_uuid = id::uuid WHERE id_uuid IS NULL;

    -- Archive old TEXT id
    ALTER TABLE public.evaluation_jobs ADD COLUMN IF NOT EXISTS id_text_legacy TEXT;
    UPDATE public.evaluation_jobs SET id_text_legacy = id WHERE id_text_legacy IS NULL;

    -- Drop old id column
    ALTER TABLE public.evaluation_jobs DROP COLUMN id;

    -- Rename id_uuid to id
    ALTER TABLE public.evaluation_jobs RENAME COLUMN id_uuid TO id;

    -- Make id PRIMARY KEY with default
    ALTER TABLE public.evaluation_jobs
      ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ALTER COLUMN id SET NOT NULL;

    -- Re-add primary key constraint
    ALTER TABLE public.evaluation_jobs DROP CONSTRAINT IF EXISTS evaluation_jobs_pkey;
    ALTER TABLE public.evaluation_jobs ADD CONSTRAINT evaluation_jobs_pkey PRIMARY KEY (id);

    -- ==============================================================================
    -- STEP 2: Add foreign key constraints
    -- ==============================================================================

    -- FK: evaluation_artifacts.job_id -> evaluation_jobs.id
    ALTER TABLE public.evaluation_artifacts DROP CONSTRAINT IF EXISTS fk_evaluation_artifacts_job_id;
    ALTER TABLE public.evaluation_artifacts
      ADD CONSTRAINT fk_evaluation_artifacts_job_id
        FOREIGN KEY (job_id) REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE;

    -- FK: manuscript_chunks.job_id -> evaluation_jobs.id
    ALTER TABLE public.manuscript_chunks DROP CONSTRAINT IF EXISTS fk_manuscript_chunks_job_id;
    ALTER TABLE public.manuscript_chunks
      ADD CONSTRAINT fk_manuscript_chunks_job_id
        FOREIGN KEY (job_id) REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE;

    RAISE NOTICE 'UUID migration complete';
  END;
END $$;
