-- Restore failure_envelope column dropped by 20260205175822_remote_schema.sql
-- Required by: lib/db/schema.ts, lib/reliability/deadLetter.ts, jobs API
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS failure_envelope JSONB NULL;

-- Restore index for failure_envelope queries
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_failure_envelope
  ON public.evaluation_jobs USING gin (failure_envelope);
