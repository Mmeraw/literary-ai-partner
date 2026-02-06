-- A5+ Iteration: Add optional error message column to evaluation_jobs
-- Date: 2026-02-06
-- Purpose: Support error tracking for failed jobs in test and production

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS error TEXT NULL;

COMMENT ON COLUMN public.evaluation_jobs.error IS
  'Optional error message or diagnostic info when job fails (supports test setup and audit trails)';
