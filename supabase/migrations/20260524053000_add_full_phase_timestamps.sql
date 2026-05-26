-- Migration: Full phase timestamp columns for all pipeline stages
-- Adds Phase 0, review_gate, and Phase 3 timestamp columns.
-- Phase 1 and Phase 2 columns already exist — preserved as-is.
--
-- Column naming convention: phase{N}_{started|completed}_at
-- review_gate uses: review_gate_entered_at, review_gate_passed_at

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS phase0_started_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS phase0_completed_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS review_gate_entered_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS review_gate_passed_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS phase3_started_at    TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS phase3_completed_at  TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.evaluation_jobs.phase0_started_at    IS 'Timestamp when Phase 0 calibration began';
COMMENT ON COLUMN public.evaluation_jobs.phase0_completed_at  IS 'Timestamp when Phase 0 calibration completed';
COMMENT ON COLUMN public.evaluation_jobs.review_gate_entered_at IS 'Timestamp when job entered the Story Layer review gate (awaiting_approval)';
COMMENT ON COLUMN public.evaluation_jobs.review_gate_passed_at  IS 'Timestamp when author approved the Story Layer (gate passed)';
COMMENT ON COLUMN public.evaluation_jobs.phase3_started_at    IS 'Timestamp when Phase 3 report assembly began';
COMMENT ON COLUMN public.evaluation_jobs.phase3_completed_at  IS 'Timestamp when Phase 3 completed and report was finalized';
