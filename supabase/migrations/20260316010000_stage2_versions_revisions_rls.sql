-- Stage 2 RLS hardening for new lineage/revision tables
-- Adds ownership-based SELECT/INSERT/UPDATE policies.

BEGIN;

ALTER TABLE public.manuscript_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revision_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_proposals ENABLE ROW LEVEL SECURITY;

-- manuscript_versions
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

-- revision_sessions
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

-- change_proposals
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
