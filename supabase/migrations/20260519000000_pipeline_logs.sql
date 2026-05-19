-- Pipeline audit log — persistent, queryable trail of structured pipeline events.
--
-- Motivation: Vercel function stdout is not retained after evaluation completes
-- and Supabase only logs DB queries, leaving no observability into the
-- pipeline's own decisions (Pass 3 truncation retries, Perplexity scorer
-- skips, preflight key presence, job outcomes). Writes are best-effort from
-- the Node pipeline; reads are admin-only via /api/admin/pipeline-logs.
--
-- Project: xtumxjnzdswuumndcbwc

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid REFERENCES evaluation_jobs(id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  stage text,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_logs_job_id_idx ON pipeline_logs (job_id);
CREATE INDEX IF NOT EXISTS pipeline_logs_created_at_idx ON pipeline_logs (created_at DESC);
