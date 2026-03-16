-- Stage 2 foundation: revision sessions + change proposals
-- Additive, non-breaking migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.revision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_run_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  source_version_id uuid NOT NULL REFERENCES public.manuscript_versions(id) ON DELETE CASCADE,
  result_version_id uuid REFERENCES public.manuscript_versions(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('open', 'applied', 'discarded')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_revision_sessions_evaluation_run_id
  ON public.revision_sessions(evaluation_run_id);

CREATE INDEX IF NOT EXISTS idx_revision_sessions_source_version_id
  ON public.revision_sessions(source_version_id);

CREATE INDEX IF NOT EXISTS idx_revision_sessions_result_version_id
  ON public.revision_sessions(result_version_id);

CREATE INDEX IF NOT EXISTS idx_revision_sessions_status
  ON public.revision_sessions(status);

CREATE TABLE IF NOT EXISTS public.change_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_session_id uuid NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
  location_ref text NOT NULL,
  rule text NOT NULL,
  action text NOT NULL CHECK (action IN ('preserve', 'refine', 'replace')),
  original_text text NOT NULL,
  proposed_text text NOT NULL,
  justification text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  decision text CHECK (decision IN ('accepted', 'rejected', 'modified')),
  modified_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_proposals_revision_session_id
  ON public.change_proposals(revision_session_id);

CREATE INDEX IF NOT EXISTS idx_change_proposals_decision
  ON public.change_proposals(decision);

COMMIT;
