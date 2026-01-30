-- Phase A.3: Admin Actions Audit Table
-- Date: 2026-01-30
-- Purpose: Append-only log for admin interventions on jobs

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL, -- 'retry_job', 'reset_attempts', 'cancel_job'
  job_id UUID NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES auth.users(id), -- Admin user ID
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Snapshot of job state before action
  before_status TEXT NOT NULL,
  before_attempt_count INTEGER,
  before_failed_at TIMESTAMPTZ,
  before_next_attempt_at TIMESTAMPTZ,
  
  -- Snapshot of job state after action
  after_status TEXT NOT NULL,
  after_attempt_count INTEGER,
  after_failed_at TIMESTAMPTZ,
  after_next_attempt_at TIMESTAMPTZ,
  
  -- Additional context
  reason TEXT, -- Optional: why this action was taken
  metadata JSONB DEFAULT '{}' -- Flexible field for additional audit data
);

-- Index for finding all actions on a specific job
CREATE INDEX idx_admin_actions_job_id ON public.admin_actions(job_id, performed_at DESC);

-- Index for finding all actions by a specific admin
CREATE INDEX idx_admin_actions_performed_by ON public.admin_actions(performed_by, performed_at DESC);

-- Index for finding recent actions
CREATE INDEX idx_admin_actions_performed_at ON public.admin_actions(performed_at DESC);

-- Enable RLS (service role only)
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access"
  ON public.admin_actions
  USING (true);

-- Prevent any direct user access (even authenticated users)
-- All operations must go through service role
CREATE POLICY "No direct user access"
  ON public.admin_actions
  FOR ALL
  TO authenticated
  USING (false);

-- Grant permissions
GRANT SELECT ON public.admin_actions TO service_role;
GRANT INSERT ON public.admin_actions TO service_role;
GRANT ALL ON public.admin_actions TO postgres;

COMMENT ON TABLE public.admin_actions IS
  'Append-only audit log for admin interventions on evaluation jobs. Service role only.';

COMMENT ON COLUMN public.admin_actions.action_type IS
  'Type of admin action: retry_job, reset_attempts, cancel_job';

COMMENT ON COLUMN public.admin_actions.metadata IS
  'Flexible JSONB field for additional audit context (e.g., IP address, user agent, etc.)';
