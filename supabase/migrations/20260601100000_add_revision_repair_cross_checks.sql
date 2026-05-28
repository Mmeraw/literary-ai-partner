-- Sidecar table for Perplexity repair cross-check verdicts.
-- Cross-checks are per finding + option key (A), not per finding alone.
-- Keyed by content hashes for cache invalidation when repair text changes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.revision_repair_cross_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys: which evaluation + finding this checks
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  finding_id uuid NOT NULL,
  option_key text NOT NULL DEFAULT 'A' CHECK (option_key IN ('A', 'B', 'C')),

  -- Verdict
  verdict text NOT NULL CHECK (verdict IN ('approve', 'flag', 'reject', 'unavailable', 'pending')),
  rationale text,
  concerns jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence integer CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 100)),

  -- Verifier guidance (private — never author-facing in Phase 1)
  improved_repair text,

  -- Provenance / reproducibility
  prompt_version text NOT NULL,
  model text NOT NULL,
  model_version text,

  -- Cache invalidation hashes (SHA-256 hex of content)
  original_text_hash text NOT NULL,
  evidence_hash text NOT NULL,
  diagnosis_hash text NOT NULL,
  proposed_repair_hash text NOT NULL,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lookup: find cross-check for a specific finding + option
CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_cross_checks_finding_option
  ON public.revision_repair_cross_checks(finding_id, option_key);

-- Lookup: all cross-checks for an evaluation job
CREATE INDEX IF NOT EXISTS idx_repair_cross_checks_evaluation_job_id
  ON public.revision_repair_cross_checks(evaluation_job_id);

-- Lookup: by verdict for TrustedPath filtering
CREATE INDEX IF NOT EXISTS idx_repair_cross_checks_verdict
  ON public.revision_repair_cross_checks(verdict);

-- RLS: service-role only (cross-checks are written by the backend, never by the client)
ALTER TABLE public.revision_repair_cross_checks ENABLE ROW LEVEL SECURITY;

-- No user-facing policies: only the service role (admin client) reads/writes this table.
-- If user-facing read access is needed later, add a SELECT policy joined through
-- evaluation_jobs → manuscripts → user_id.

COMMIT;
