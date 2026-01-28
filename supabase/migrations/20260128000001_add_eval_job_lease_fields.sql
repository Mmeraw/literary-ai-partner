-- Migration: Add lease/worker fields required for atomic claiming
-- Ensures evaluation_jobs supports worker_id + lease-based recovery

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS lease_token UUID;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status_lease
  ON public.evaluation_jobs (status, lease_until);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_worker_id
  ON public.evaluation_jobs (worker_id);
