-- Create audit_entries table for RPC-level contract evidence
-- Date: 2026-02-05
-- Contract: JOB_CONTRACT_v1 (Phase B Step 6: Evidence & audit logging)
--
-- Purpose: DB-side audit trail for SQL/RPC mutation surfaces
-- TypeScript writes to JSONL files; RPCs write here (exportable to JSONL)
--
-- Design:
--   - Append-only (no updates/deletes)
--   - Indexed for fast queries by job_id, event_type, ok
--   - Exportable to JSONL for unified evidence bundle

CREATE TABLE IF NOT EXISTS public.audit_entries (
  -- Primary key
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Schema version (for future migrations)
  schema_version TEXT NOT NULL DEFAULT 'audit_entry_v1',
  
  -- When did this happen?
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- What kind of event?
  event_type TEXT NOT NULL,  -- job.transition | job.creation | job.claim | job.retry
  
  -- Did it succeed?
  ok BOOLEAN NOT NULL,
  
  -- Who did it?
  actor TEXT NOT NULL,  -- worker | api | admin | system | rpc
  
  -- Which job? (nullable for failed creations)
  job_id UUID,
  
  -- What was the transition?
  from_status TEXT,  -- queued | running | complete | failed | null
  to_status TEXT NOT NULL,  -- queued | running | complete | failed
  
  -- Contract decision
  decision_code TEXT NOT NULL,  -- ALLOWED | ILLEGAL_TRANSITION | ...
  contract_id TEXT NOT NULL DEFAULT 'JOB_CONTRACT_v1',
  contract_section TEXT NOT NULL,  -- 5.1 | 3.2 | 6.1 | ...
  
  -- Human-readable explanation (optional)
  reason TEXT,
  
  -- Trace correlation (optional but recommended)
  request_id TEXT,
  
  -- Where did this originate?
  source TEXT NOT NULL,  -- ts | rpc | api-route | worker | admin-ui
  
  -- Additional context (JSONB for flexibility, no PII)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraints
  CONSTRAINT chk_audit_event_type CHECK (event_type IN ('job.transition', 'job.creation', 'job.claim', 'job.retry')),
  CONSTRAINT chk_audit_actor CHECK (actor IN ('worker', 'api', 'admin', 'system', 'rpc')),
  CONSTRAINT chk_audit_status CHECK (
    from_status IS NULL OR from_status IN ('queued', 'running', 'complete', 'failed')
  ),
  CONSTRAINT chk_audit_to_status CHECK (to_status IN ('queued', 'running', 'complete', 'failed')),
  CONSTRAINT chk_audit_source CHECK (source IN ('ts', 'rpc', 'api-route', 'worker', 'admin-ui', 'sql'))
);

-- Indexes for fast queries
CREATE INDEX idx_audit_entries_ts ON public.audit_entries(ts DESC);
CREATE INDEX idx_audit_entries_job_id ON public.audit_entries(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX idx_audit_entries_ok ON public.audit_entries(ok) WHERE ok = false;  -- Partial: violations only
CREATE INDEX idx_audit_entries_event_type ON public.audit_entries(event_type);
CREATE INDEX idx_audit_entries_decision_code ON public.audit_entries(decision_code);

-- RLS: read-only for app users, write-only for service role
ALTER TABLE public.audit_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_entries_read_own ON public.audit_entries
  FOR SELECT TO authenticated
  USING (
    -- Users can read audit entries for their own jobs
    job_id IN (
      SELECT j.id FROM public.evaluation_jobs j
      INNER JOIN public.manuscripts m ON j.manuscript_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

-- Service role can insert (but not update/delete)
CREATE POLICY audit_entries_insert_service ON public.audit_entries
  FOR INSERT TO service_role
  WITH CHECK (true);

COMMENT ON TABLE public.audit_entries IS
'Append-only audit log for JOB_CONTRACT_v1 enforcement.
RPC-level evidence (claim, retry, etc.) writes here.
TypeScript evidence writes to JSONL files.
Exportable to JSONL for unified evidence bundle.';

COMMENT ON COLUMN public.audit_entries.schema_version IS
'Schema version for forward compatibility (currently audit_entry_v1).';

COMMENT ON COLUMN public.audit_entries.metadata IS
'Small additional context (no PII). Examples: retry_count, parent_job_id, error codes.';
