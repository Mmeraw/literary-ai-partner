-- Migration: claim_evaluation_job_phase2 RPC
-- Purpose: Atomic job claiming for PHASE 2 to prevent app-layer claim races
--
-- Claim contract:
--   - job must already be status='running'
--   - eligible handoff state: progress.phase='phase_1' AND progress.phase_status='complete'
--   - eligible resume state: progress.phase='phase_2' AND progress.phase_status='running'
--   - lease must be free OR expired with heartbeat newer than expiry

CREATE OR REPLACE FUNCTION public.claim_evaluation_job_phase2(
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
    progress = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(progress, '{}'::jsonb),
            '{lease_id}', to_jsonb(p_lease_id)
          ),
          '{lease_expires_at}', to_jsonb((now() + make_interval(secs => p_ttl_seconds))::text)
        ),
        '{phase}', '"phase_2"'
      ),
      '{phase_status}', '"running"'
    ),
    updated_at = now()
  WHERE
    id = p_job_id
    AND status = 'running'
    AND (
      (
        COALESCE(progress->>'phase', '') = 'phase_1'
        AND COALESCE(progress->>'phase_status', '') = 'complete'
      )
      OR
      (
        COALESCE(progress->>'phase', '') = 'phase_2'
        AND COALESCE(progress->>'phase_status', '') = 'running'
      )
    )
    AND (
      COALESCE(progress->>'lease_id', '') = ''
      OR (
        COALESCE(progress->>'lease_expires_at', '') <> ''
        AND (progress->>'lease_expires_at')::timestamptz <= now()
        AND last_heartbeat IS NOT NULL
        AND last_heartbeat::timestamptz > (progress->>'lease_expires_at')::timestamptz
      )
    )
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_evaluation_job_phase2(uuid, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_job_phase2(uuid, text, integer) TO service_role;

COMMENT ON FUNCTION public.claim_evaluation_job_phase2 IS
'PR E: Atomic Phase 2 claim RPC. Prevents concurrent Phase 2 claim races by moving ownership gating into SQL.';
