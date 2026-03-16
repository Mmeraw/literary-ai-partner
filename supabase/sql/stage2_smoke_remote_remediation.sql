-- Stage 2 remote remediation for smoke harness
-- Target project: xtumxjnzdswuumndcbwc
-- Purpose: make the app-facing Stage 2 API surface fully available to PostgREST.
-- Safe to run in Supabase SQL Editor. Designed to be additive and idempotent.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Immutable manuscript versions foundation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.manuscript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id bigint NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  source_version_id uuid REFERENCES public.manuscript_versions(id) ON DELETE SET NULL,
  raw_text text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT manuscript_versions_version_number_positive CHECK (version_number > 0),
  CONSTRAINT manuscript_versions_word_count_nonnegative CHECK (word_count >= 0),
  CONSTRAINT manuscript_versions_unique_per_manuscript UNIQUE (manuscript_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_manuscript_versions_manuscript_id
  ON public.manuscript_versions(manuscript_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_versions_source_version_id
  ON public.manuscript_versions(source_version_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_versions_created_at
  ON public.manuscript_versions(created_at DESC);

-- Required Stage 2 binding on evaluation jobs.
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS manuscript_version_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'evaluation_jobs'
      AND constraint_name = 'evaluation_jobs_manuscript_version_id_fkey'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ADD CONSTRAINT evaluation_jobs_manuscript_version_id_fkey
      FOREIGN KEY (manuscript_version_id)
      REFERENCES public.manuscript_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_manuscript_version_id
  ON public.evaluation_jobs(manuscript_version_id);

-- Backfill initial immutable version for each manuscript.
INSERT INTO public.manuscript_versions (
  manuscript_id,
  version_number,
  source_version_id,
  raw_text,
  word_count,
  created_by,
  created_at
)
SELECT
  m.id,
  1,
  NULL,
  '',
  COALESCE(m.word_count, 0),
  m.created_by,
  COALESCE(m.created_at, now())
FROM public.manuscripts m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manuscript_versions mv
  WHERE mv.manuscript_id = m.id
    AND mv.version_number = 1
);

-- Backfill existing jobs to v1 where possible.
UPDATE public.evaluation_jobs ej
SET manuscript_version_id = mv.id
FROM public.manuscript_versions mv
WHERE ej.manuscript_id = mv.manuscript_id
  AND mv.version_number = 1
  AND ej.manuscript_version_id IS NULL;

-- ---------------------------------------------------------------------------
-- 2) Revision sessions + change proposals
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3) RLS hardening for Stage 2 tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.manuscript_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manuscript versions" ON public.manuscript_versions;
CREATE POLICY "Users can view own manuscript versions"
  ON public.manuscript_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscripts m
      WHERE m.id = manuscript_versions.manuscript_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own manuscript versions" ON public.manuscript_versions;
CREATE POLICY "Users can insert own manuscript versions"
  ON public.manuscript_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manuscripts m
      WHERE m.id = manuscript_versions.manuscript_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can view own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can view own revision sessions"
  ON public.revision_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can insert own revision sessions"
  ON public.revision_sessions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own revision sessions" ON public.revision_sessions;
CREATE POLICY "Users can update own revision sessions"
  ON public.revision_sessions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can view own change proposals" ON public.change_proposals;
CREATE POLICY "Users can view own change proposals"
  ON public.change_proposals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own change proposals" ON public.change_proposals;
CREATE POLICY "Users can insert own change proposals"
  ON public.change_proposals
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own change proposals" ON public.change_proposals;
CREATE POLICY "Users can update own change proposals"
  ON public.change_proposals
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

COMMIT;

-- ---------------------------------------------------------------------------
-- 4) Force PostgREST / Supabase REST schema cache reload
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 5) Verification queries (run after the script completes)
-- ---------------------------------------------------------------------------
-- SELECT to_regclass('public.manuscript_versions') AS manuscript_versions,
--        to_regclass('public.revision_sessions') AS revision_sessions,
--        to_regclass('public.change_proposals') AS change_proposals;
--
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'evaluation_jobs'
--   AND column_name = 'manuscript_version_id';
