-- Stage 2 additive architecture improvement: normalized diagnostic findings layer
-- evaluation_artifacts -> diagnostic_findings -> change_proposals

BEGIN;

CREATE TABLE IF NOT EXISTS public.diagnostic_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  manuscript_version_id uuid REFERENCES public.manuscript_versions(id) ON DELETE SET NULL,
  artifact_id uuid REFERENCES public.evaluation_artifacts(id) ON DELETE SET NULL,

  criterion_key text NOT NULL,
  wave_id text,
  finding_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  confidence numeric,

  location_ref text,
  chunk_id uuid,
  chapter_index integer,
  paragraph_index integer,
  sentence_index integer,

  original_text text,
  evidence_excerpt text,
  diagnosis text NOT NULL,
  recommendation text,

  action_hint text CHECK (action_hint IN ('preserve', 'refine', 'replace')),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_evaluation_job_id
  ON public.diagnostic_findings(evaluation_job_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_manuscript_version_id
  ON public.diagnostic_findings(manuscript_version_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_criterion_key
  ON public.diagnostic_findings(criterion_key);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_wave_id
  ON public.diagnostic_findings(wave_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_finding_type
  ON public.diagnostic_findings(finding_type);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_status
  ON public.diagnostic_findings(status);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_location_ref
  ON public.diagnostic_findings(location_ref);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_action_hint
  ON public.diagnostic_findings(action_hint);

COMMIT;
