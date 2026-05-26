-- Final Review apply/export runtime persistence.
-- Adds payload snapshots to ledger decisions and records apply/export runs.

BEGIN;

ALTER TABLE public.revision_ledger_decisions
  ADD COLUMN IF NOT EXISTS selected_text text,
  ADD COLUMN IF NOT EXISTS source_excerpt text,
  ADD COLUMN IF NOT EXISTS source_location text;

CREATE TABLE IF NOT EXISTS public.final_review_apply_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  source_version_id uuid NOT NULL REFERENCES public.manuscript_versions(id) ON DELETE CASCADE,
  revised_version_id uuid REFERENCES public.manuscript_versions(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('blocked', 'applied', 'exported')),
  mode text NOT NULL CHECK (mode IN ('apply', 'export_clean', 'export_marked', 'export_changelog')),
  applied_decision_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  skipped_decision_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  blocked_reason text,
  export_format text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_review_apply_runs_user_id
  ON public.final_review_apply_runs(user_id);

CREATE INDEX IF NOT EXISTS idx_final_review_apply_runs_manuscript_id
  ON public.final_review_apply_runs(manuscript_id);

CREATE INDEX IF NOT EXISTS idx_final_review_apply_runs_evaluation_job_id
  ON public.final_review_apply_runs(evaluation_job_id);

CREATE INDEX IF NOT EXISTS idx_final_review_apply_runs_created_at
  ON public.final_review_apply_runs(created_at DESC);

ALTER TABLE public.final_review_apply_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS final_review_apply_runs_select_own ON public.final_review_apply_runs;
CREATE POLICY final_review_apply_runs_select_own
  ON public.final_review_apply_runs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS final_review_apply_runs_insert_own ON public.final_review_apply_runs;
CREATE POLICY final_review_apply_runs_insert_own
  ON public.final_review_apply_runs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMIT;
