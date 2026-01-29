-- Migration: evaluation_artifacts table with DB-level uniqueness guarantee
-- Purpose: Phase 2 output storage with idempotency at DB layer
-- Created: 2026-01-24

CREATE TABLE IF NOT EXISTS public.evaluation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT NOT NULL,
  manuscript_id BIGINT NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL,
  artifact_version TEXT NOT NULL DEFAULT 'v1',

  -- Artifact payload
  content JSONB NOT NULL,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_phase TEXT NOT NULL DEFAULT 'phase_2',

  -- Source data integrity hash (for detecting input drift)
  source_hash TEXT,

  -- DB-level idempotency guarantee
  CONSTRAINT unique_job_artifact UNIQUE (job_id, artifact_type)
);

-- Index for querying artifacts by manuscript (guarded for prod parity)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'evaluation_artifacts'
      AND column_name  = 'manuscript_id'
  ) THEN
    EXECUTE
      'CREATE INDEX IF NOT EXISTS idx_evaluation_artifacts_manuscript_id
       ON public.evaluation_artifacts(manuscript_id)';
  ELSE
    RAISE NOTICE
      'Skipping idx_evaluation_artifacts_manuscript_id: public.evaluation_artifacts.manuscript_id does not exist';
  END IF;
END $$;

-- Index for querying artifacts by type
CREATE INDEX IF NOT EXISTS idx_evaluation_artifacts_type
  ON public.evaluation_artifacts (artifact_type);

-- RLS policies (service role only for Phase 2)
ALTER TABLE public.evaluation_artifacts ENABLE ROW LEVEL SECURITY;

-- Service role can do anything (for worker daemon)
DROP POLICY IF EXISTS "Service role full access" ON public.evaluation_artifacts;

CREATE POLICY "Service role full access"
  ON public.evaluation_artifacts
  FOR ALL
  USING (true);

-- Authors can view artifacts for jobs that belong to manuscripts they created
DROP POLICY IF EXISTS "Authors view own artifacts" ON public.evaluation_artifacts;

CREATE POLICY "Authors view own artifacts"
  ON public.evaluation_artifacts
  FOR SELECT
  USING (
    (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'author'
    AND EXISTS (
      SELECT 1
      FROM public.evaluation_jobs j
      JOIN public.manuscripts m ON m.id = j.manuscript_id
      WHERE j.id = evaluation_artifacts.job_id
        AND m.created_by = auth.uid()
    )
  );

COMMENT ON TABLE public.evaluation_artifacts IS
  'Phase 2+ output artifacts with DB-level idempotency guarantee via UNIQUE(job_id, artifact_type)';

COMMENT ON CONSTRAINT unique_job_artifact ON public.evaluation_artifacts IS
  'Prevents duplicate artifacts: INSERT ... ON CONFLICT DO NOTHING enforces idempotency';
