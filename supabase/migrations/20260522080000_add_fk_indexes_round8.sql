-- Round 8: Add missing FK indexes flagged by unindexed_foreign_keys advisor
-- Covers 8 foreign key columns across 5 tables that had no covering index.
-- All use IF NOT EXISTS to be idempotent.

-- collection_artifacts.added_by → auth.users
CREATE INDEX IF NOT EXISTS idx_collection_artifacts_added_by
  ON public.collection_artifacts (added_by);

-- diagnostic_findings.artifact_id → evaluation_artifacts
CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_artifact_id
  ON public.diagnostic_findings (artifact_id);

-- evaluation_events.project_id → evaluation_projects
CREATE INDEX IF NOT EXISTS idx_evaluation_events_project_id
  ON public.evaluation_events (project_id);

-- evaluation_events.stage_run_id → evaluation_stage_runs
CREATE INDEX IF NOT EXISTS idx_evaluation_events_stage_run_id
  ON public.evaluation_events (stage_run_id);

-- evaluation_jobs.evaluation_project_id → evaluation_projects
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_evaluation_project_id
  ON public.evaluation_jobs (evaluation_project_id);

-- evaluation_jobs.user_id → auth.users
DO $$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NULL THEN
    RAISE NOTICE 'Skipping idx_evaluation_jobs_user_id; evaluation_jobs table is absent';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evaluation_jobs'
      AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_user_id
      ON public.evaluation_jobs (user_id);
  ELSE
    RAISE NOTICE 'Skipping idx_evaluation_jobs_user_id; user_id column is absent';
  END IF;
END;
$$;

-- revision_events.manuscript_id → manuscripts
CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_id
  ON public.revision_events (manuscript_id);

-- revision_events.manuscript_version_id → manuscript_versions
-- (Round 4 added this but advisor still flagging — ensure it exists)
CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_version_id
  ON public.revision_events (manuscript_version_id);
