-- Relax legacy top-level phase columns to align with JSON progress model
-- This migration makes evaluation_jobs.phase and evaluation_jobs.phase_status nullable.
-- Safe to run multiple times; no-ops if columns already nullable or absent.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluation_jobs'
      AND column_name = 'phase'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ALTER COLUMN phase DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluation_jobs'
      AND column_name = 'phase_status'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ALTER COLUMN phase_status DROP NOT NULL;
  END IF;
END $$;

-- Optionally, you can also drop defaults or constraints tied to these columns here
-- if your schema set any. This file intentionally keeps the change minimal.
