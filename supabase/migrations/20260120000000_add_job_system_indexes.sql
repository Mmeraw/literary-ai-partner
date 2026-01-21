-- Add indexes for job system performance
-- Run after schema is deployed

-- Index on status for retry tick scans
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status ON public.evaluation_jobs (status);

-- Index on next_retry_at for retry eligibility scans
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_next_retry_at ON public.evaluation_jobs (next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Index on progress fields if needed (for now, keep simple)
-- Expression index for phase status if queries filter on it
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_progress_phase_status ON public.evaluation_jobs ((progress->>'phase_status')) WHERE progress->>'phase_status' IS NOT NULL;