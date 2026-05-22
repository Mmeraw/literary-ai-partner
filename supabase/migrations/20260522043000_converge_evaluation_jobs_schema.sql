-- =============================================================================
-- Migration: Schema Convergence — evaluation_jobs runtime contract
-- Date: 2026-05-23
-- Purpose: Guarantee runtime-contract columns exist before any RLS/policy
--          migration references them. Idempotent and environment-agnostic
--          (production already has these; CI/local resets may not).
-- =============================================================================

DO $$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NULL THEN
    RAISE NOTICE 'Skipping schema convergence: public.evaluation_jobs not present';
    RETURN;
  END IF;

  -- D1: user_id (runtime contract — owner attribution)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='evaluation_jobs' AND column_name='user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.evaluation_jobs ADD COLUMN user_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_user_id ON public.evaluation_jobs(user_id)';
  END IF;

  -- D2: project_id (referenced by hybrid RLS policy)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='evaluation_jobs' AND column_name='project_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.evaluation_jobs ADD COLUMN project_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_project_id ON public.evaluation_jobs(project_id)';
  END IF;

  -- D3: manuscript_id (referenced by hybrid RLS policy)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='evaluation_jobs' AND column_name='manuscript_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.evaluation_jobs ADD COLUMN manuscript_id uuid';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_manuscript_id ON public.evaluation_jobs(manuscript_id)';
  END IF;
END $$;
