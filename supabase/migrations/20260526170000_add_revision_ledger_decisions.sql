-- Server-synced Revision Ledger decisions
-- Local-first workbench decisions sync here for cross-device history and dashboard analytics.

BEGIN;

CREATE TABLE IF NOT EXISTS public.revision_ledger_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manuscript_id bigint NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  finding_id uuid,
  opportunity_id text NOT NULL,
  opportunity_title text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('accepted_a', 'accepted_b', 'accepted_c', 'custom', 'keep_original', 'reject', 'deferred')),
  selected_option text CHECK (selected_option IN ('A', 'B', 'C')),
  custom_text text,
  local_id text NOT NULL,
  client_created_at timestamptz,
  client_synced_at timestamptz NOT NULL DEFAULT now(),
  is_undo boolean NOT NULL DEFAULT false,
  undone_local_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, evaluation_job_id, local_id)
);

CREATE INDEX IF NOT EXISTS idx_revision_ledger_decisions_user_id
  ON public.revision_ledger_decisions(user_id);

CREATE INDEX IF NOT EXISTS idx_revision_ledger_decisions_manuscript_id
  ON public.revision_ledger_decisions(manuscript_id);

CREATE INDEX IF NOT EXISTS idx_revision_ledger_decisions_evaluation_job_id
  ON public.revision_ledger_decisions(evaluation_job_id);

CREATE INDEX IF NOT EXISTS idx_revision_ledger_decisions_opportunity_id
  ON public.revision_ledger_decisions(opportunity_id);

CREATE INDEX IF NOT EXISTS idx_revision_ledger_decisions_decision
  ON public.revision_ledger_decisions(decision);

CREATE INDEX IF NOT EXISTS idx_revision_ledger_decisions_created_at
  ON public.revision_ledger_decisions(created_at DESC);

ALTER TABLE public.revision_ledger_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS revision_ledger_decisions_select_own ON public.revision_ledger_decisions;
CREATE POLICY revision_ledger_decisions_select_own
  ON public.revision_ledger_decisions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS revision_ledger_decisions_insert_own ON public.revision_ledger_decisions;
CREATE POLICY revision_ledger_decisions_insert_own
  ON public.revision_ledger_decisions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS revision_ledger_decisions_update_own ON public.revision_ledger_decisions;
CREATE POLICY revision_ledger_decisions_update_own
  ON public.revision_ledger_decisions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
