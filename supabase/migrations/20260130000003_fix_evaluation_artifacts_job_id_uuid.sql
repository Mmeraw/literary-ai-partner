-- Phase A.2: Convert evaluation_artifacts.job_id from TEXT to UUID with FK
-- Date: 2026-01-30
-- Purpose: Fix type mismatch and add referential integrity (reset-safe)

BEGIN;

-- Policy depends on job_id, so drop it before altering the column type
DROP POLICY IF EXISTS "Authors view own artifacts" ON public.evaluation_artifacts;

-- Convert job_id from TEXT -> UUID
ALTER TABLE public.evaluation_artifacts
  ALTER COLUMN job_id TYPE uuid USING job_id::uuid;

-- Add FK to evaluation_jobs(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_artifacts_job_id_fkey'
      AND conrelid = 'public.evaluation_artifacts'::regclass
  ) THEN
    ALTER TABLE public.evaluation_artifacts
      ADD CONSTRAINT evaluation_artifacts_job_id_fkey
      FOREIGN KEY (job_id)
      REFERENCES public.evaluation_jobs(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Recreate policy using UUID-safe comparison
CREATE POLICY "Authors view own artifacts"
  ON public.evaluation_artifacts
  FOR SELECT
  USING (
    (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'author'
    AND EXISTS (
      SELECT 1
      FROM public.evaluation_jobs j
      JOIN public.manuscripts m ON m.id = j.manuscript_id
      WHERE j.id = evaluation_artifacts.job_id
        AND m.created_by = auth.uid()
    )
  );

COMMIT;
