-- PR13: Artifact staleness propagation substrate.
--
-- Intent:
-- - Do not create a second artifact table.
-- - Extend existing evaluation_artifacts lineage tracking.
-- - Mark dependent support artifacts STALE when the accepted ledger source hash changes.

ALTER TABLE public.evaluation_artifacts
  ADD COLUMN IF NOT EXISTS freshness_status text NOT NULL DEFAULT 'CURRENT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_artifacts_freshness_status_check'
  ) THEN
    ALTER TABLE public.evaluation_artifacts
      ADD CONSTRAINT evaluation_artifacts_freshness_status_check
      CHECK (freshness_status IN ('CURRENT', 'STALE', 'DEGRADED_VERSION_MISMATCH'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.artifact_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_type text NOT NULL,
  dependent_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_type, dependent_type)
);

INSERT INTO public.artifact_dependencies (parent_type, dependent_type) VALUES
  ('accepted_story_ledger_v1', 'story_shape_signal_map_v1'),
  ('accepted_story_ledger_v1', 'manuscript_signal_appendix_v1')
ON CONFLICT DO NOTHING;

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

DROP TRIGGER IF EXISTS trigger_propagate_artifact_staleness ON public.evaluation_artifacts;
CREATE TRIGGER trigger_propagate_artifact_staleness
AFTER UPDATE OF source_hash ON public.evaluation_artifacts
FOR EACH ROW
WHEN (OLD.source_hash IS DISTINCT FROM NEW.source_hash)
EXECUTE FUNCTION public.propagate_artifact_staleness();
