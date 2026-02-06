-- Migration: Add phase_status column to evaluation_jobs for test harness compatibility
-- Purpose: PostgREST schema cache rejects inserts referencing 'phase_status' if column absent
-- Created: 2026-02-06

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS phase_status TEXT NULL;

COMMENT ON COLUMN public.evaluation_jobs.phase_status IS
  'Compatibility column for CI harness (jobs-admin-retry-concurrency.mjs). Tracks per-phase status when creating failed jobs.';
