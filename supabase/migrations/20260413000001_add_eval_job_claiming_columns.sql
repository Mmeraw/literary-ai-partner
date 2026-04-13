-- Migration: Add atomic claiming columns for evaluation jobs
-- Date: 2026-04-13
-- Purpose: Support atomic job claiming in processor.ts via claim_evaluation_jobs RPC
--
-- Adds:
--   claimed_by        TEXT        — worker ID that claimed this job (processor path)
--   claimed_at        TIMESTAMPTZ — when the processor claimed the job
--   lease_expires_at  TIMESTAMPTZ — when the processor claim lease expires

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS claimed_by TEXT;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS lease_token TEXT;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Index: quickly find expired leases for failStaleRunningJobs recovery
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_lease_expires_at
  ON public.evaluation_jobs (status, lease_expires_at)
  WHERE status = 'running' AND lease_expires_at IS NOT NULL;

-- Index: support queued claiming queries (status + phase + phase_status)
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_claim_queue
  ON public.evaluation_jobs (status, phase_status, created_at)
  WHERE status = 'queued';

COMMENT ON COLUMN public.evaluation_jobs.claimed_by IS
  'PR B: Worker ID that atomically claimed this job via claim_evaluation_jobs RPC. NULL for unclaimed jobs.';

COMMENT ON COLUMN public.evaluation_jobs.claimed_at IS
  'PR B: Timestamp when the processor worker claimed this job atomically.';

COMMENT ON COLUMN public.evaluation_jobs.lease_token IS
  'PR B: Lease token for claim ownership during processor execution.';

COMMENT ON COLUMN public.evaluation_jobs.lease_expires_at IS
  'PR B: Processor claim lease expiry. Jobs with expired leases are eligible for recovery by failStaleRunningJobs().';
