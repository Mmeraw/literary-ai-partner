-- Stage 2 RLS hardening for diagnostic_findings

BEGIN;

ALTER TABLE public.diagnostic_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own diagnostic findings" ON public.diagnostic_findings;
CREATE POLICY "Users can view own diagnostic findings"
  ON public.diagnostic_findings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own diagnostic findings" ON public.diagnostic_findings;
CREATE POLICY "Users can insert own diagnostic findings"
  ON public.diagnostic_findings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own diagnostic findings" ON public.diagnostic_findings;
CREATE POLICY "Users can update own diagnostic findings"
  ON public.diagnostic_findings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
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
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

COMMIT;
