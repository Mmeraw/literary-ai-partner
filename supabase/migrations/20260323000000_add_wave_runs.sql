-- Stage 2 additive architecture improvement: persist WAVE execution runs

BEGIN;

CREATE TABLE IF NOT EXISTS public.wave_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_session_id uuid NOT NULL REFERENCES public.revision_sessions(id) ON DELETE CASCADE,
  wave_number integer NOT NULL,
  wave_name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  proposed_text_hash text NOT NULL,
  changes_count integer NOT NULL DEFAULT 0,
  modifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_ms integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wave_runs_revision_session_id
  ON public.wave_runs(revision_session_id);

CREATE INDEX IF NOT EXISTS idx_wave_runs_wave_number
  ON public.wave_runs(wave_number);

ALTER TABLE public.wave_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wave runs" ON public.wave_runs;
CREATE POLICY "Users can view own wave runs"
  ON public.wave_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own wave runs" ON public.wave_runs;
CREATE POLICY "Users can insert own wave runs"
  ON public.wave_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own wave runs" ON public.wave_runs;
CREATE POLICY "Users can update own wave runs"
  ON public.wave_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.revision_sessions rs
      JOIN public.manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
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
      WHERE rs.id = wave_runs.revision_session_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

COMMIT;
