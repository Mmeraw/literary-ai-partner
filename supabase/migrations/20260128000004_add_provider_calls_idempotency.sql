-- Migration: Add idempotency constraint to evaluation_provider_calls
-- Ensures exactly-once persistence per job + provider + phase
-- Phase 2D Slice 2: Idempotency proof

-- Add unique constraint on (job_id, provider, phase)
-- This prevents duplicate provider call records for the same job execution
ALTER TABLE public.evaluation_provider_calls
  ADD CONSTRAINT unique_provider_call_per_job 
  UNIQUE(job_id, provider, phase);

COMMENT ON CONSTRAINT unique_provider_call_per_job ON public.evaluation_provider_calls IS
  'Phase 2D idempotency: prevents duplicate provider call records on retry/crash/reclaim. Use with ON CONFLICT DO UPDATE or DO NOTHING.';
