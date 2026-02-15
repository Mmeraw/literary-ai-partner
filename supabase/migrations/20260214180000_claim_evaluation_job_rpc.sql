-- Migration: claim_evaluation_job_phase1 RPC
-- Purpose: Atomic job claiming for PHASE 1 ONLY to prevent race conditions at scale
-- QC Gate 2: DB-atomic claim (eliminates network jitter races)
--
-- CRITICAL: This includes a PHASE GUARD to prevent stealing Phase 2+ jobs

-- Function: claim_evaluation_job_phase1
-- Atomically claims a job for PHASE 1 if:
--   (a) status = 'queued' (fresh claim)
--   OR
--   (b) status = 'running' AND phase is phase_1 AND lease is expired (safe recovery)
--
-- IMPORTANT: This prevents stealing Phase 2+ jobs whose lease expired.

CREATE OR REPLACE FUNCTION public.claim_evaluation_job_phase1(
  p_job_id uuid,
  p_lease_id text,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS SETOF public.evaluation_jobs
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.evaluation_jobs
  SET
    status = 'running',
    progress = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(progress, '{}'::jsonb),
            '{lease_id}', to_jsonb(p_lease_id)
          ),
          '{lease_expires_at}', to_jsonb((now() + make_interval(secs => p_ttl_seconds))::text)
        ),
        '{phase}', '"phase_1"'
      ),
      '{phase_status}', '"running"'
    ),
    updated_at = now()
  WHERE
    id = p_job_id
    AND (
      -- Fresh claim from queue
      status = 'queued'

      -- Safe recovery ONLY for Phase 1 jobs (PHASE GUARD)
      OR (
        status = 'running'
        AND (COALESCE(progress->>'phase','') = 'phase_1')
        AND (COALESCE(progress->>'lease_expires_at','') <> '')
        AND (progress->>'lease_expires_at')::timestamptz <= now()
      )
    )
  RETURNING *;
$$;

-- Lock down execute rights (service_role only for worker)
REVOKE ALL ON FUNCTION public.claim_evaluation_job_phase1(uuid, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_phase1(uuid, text, integer) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_job_phase1 IS
'QC Gate 2: Atomic job claim RPC for Phase 1 ONLY. Includes PHASE GUARD to prevent stealing Phase 2+ jobs. Returns claimed row or empty set.';
