-- Fix: align artifact staleness trigger contract with production schema.
--
-- Root cause observed in production:
--   propagate_artifact_staleness() references child.evaluation_project_id,
--   but evaluation_artifacts lacked that top-level column.
--
-- Patch:
-- 1) Add nullable evaluation_project_id on evaluation_artifacts.
-- 2) Add supporting index.
-- 3) Backfill from evaluation_jobs by job_id.
-- 4) Recreate trigger function with project-aware filter (null-safe).

ALTER TABLE public.evaluation_artifacts
  ADD COLUMN IF NOT EXISTS evaluation_project_id uuid;

CREATE INDEX IF NOT EXISTS idx_evaluation_artifacts_evaluation_project_id
  ON public.evaluation_artifacts (evaluation_project_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_artifacts_evaluation_project_id_fkey'
      AND conrelid = 'public.evaluation_artifacts'::regclass
  ) THEN
    ALTER TABLE public.evaluation_artifacts
      ADD CONSTRAINT evaluation_artifacts_evaluation_project_id_fkey
      FOREIGN KEY (evaluation_project_id)
      REFERENCES public.evaluation_projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.evaluation_artifacts ea
SET evaluation_project_id = ej.evaluation_project_id
FROM public.evaluation_jobs ej
WHERE ea.job_id = ej.id
  AND ea.evaluation_project_id IS NULL
  AND ej.evaluation_project_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.propagate_artifact_staleness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.evaluation_artifacts child
  SET freshness_status = 'STALE',
      updated_at = now()
  WHERE child.evaluation_project_id IS NOT DISTINCT FROM NEW.evaluation_project_id
    AND child.job_id = NEW.job_id
    AND child.manuscript_id = NEW.manuscript_id
    AND child.artifact_type IN (
      SELECT dependent_type
      FROM public.artifact_dependencies
      WHERE parent_type = NEW.artifact_type
    )
    AND child.freshness_status <> 'STALE';

  RETURN NEW;
END;
$$;
