-- Migration: Add trust-layer validity + stage timestamp fields to evaluation_jobs
-- Purpose: Separate release validity from canonical lifecycle status and persist per-stage timing evidence.

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pass1_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pass2_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pass3_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS validity_status TEXT,
  ADD COLUMN IF NOT EXISTS validity_reason TEXT;

UPDATE public.evaluation_jobs
SET queued_at = COALESCE(queued_at, created_at)
WHERE queued_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_jobs_status_canonical_ck'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ADD CONSTRAINT evaluation_jobs_status_canonical_ck
      CHECK (status IN ('queued', 'running', 'complete', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_jobs_phase_status_canonical_ck'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ADD CONSTRAINT evaluation_jobs_phase_status_canonical_ck
      CHECK (phase_status IS NULL OR phase_status IN ('queued', 'running', 'complete', 'failed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_jobs_validity_status_ck'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ADD CONSTRAINT evaluation_jobs_validity_status_ck
      CHECK (validity_status IS NULL OR validity_status IN ('valid', 'invalid', 'disputed'));
  END IF;
END $$;