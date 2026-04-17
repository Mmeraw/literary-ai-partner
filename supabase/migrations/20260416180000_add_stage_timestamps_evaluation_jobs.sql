-- Migration: Add per-stage timestamp columns to evaluation_jobs
-- Date: 2026-04-16
-- Purpose: R4 observability requirement — auditable stage-level timing
-- for queued, phase 1 start/complete, phase 2 start/complete, and terminal states.
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS phase1_started_at TIMESTAMPTZ NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS phase1_completed_at TIMESTAMPTZ NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS phase2_started_at TIMESTAMPTZ NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS phase2_completed_at TIMESTAMPTZ NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ NULL;

-- Backfill queued_at from created_at for existing rows where queued_at is null
UPDATE public.evaluation_jobs
  SET queued_at = created_at
  WHERE queued_at IS NULL AND created_at IS NOT NULL;

-- Backfill completed_at from updated_at for already-complete jobs
UPDATE public.evaluation_jobs
  SET completed_at = updated_at
  WHERE completed_at IS NULL AND status = 'complete' AND updated_at IS NOT NULL;

-- Backfill failed_at from updated_at for already-failed jobs
UPDATE public.evaluation_jobs
  SET failed_at = updated_at
  WHERE failed_at IS NULL AND status = 'failed' AND updated_at IS NOT NULL;

COMMENT ON COLUMN public.evaluation_jobs.queued_at IS 'Timestamp when job entered queued state (set at insert time)';
COMMENT ON COLUMN public.evaluation_jobs.phase1_started_at IS 'Timestamp when phase 1 processing began';
COMMENT ON COLUMN public.evaluation_jobs.phase1_completed_at IS 'Timestamp when phase 1 processing completed';
COMMENT ON COLUMN public.evaluation_jobs.phase2_started_at IS 'Timestamp when phase 2 (artifact persistence) began';
COMMENT ON COLUMN public.evaluation_jobs.phase2_completed_at IS 'Timestamp when phase 2 completed and job reached terminal state';
COMMENT ON COLUMN public.evaluation_jobs.completed_at IS 'Timestamp when job reached complete terminal state';
COMMENT ON COLUMN public.evaluation_jobs.failed_at IS 'Timestamp when job reached failed terminal state';
