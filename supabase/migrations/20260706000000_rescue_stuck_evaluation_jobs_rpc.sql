-- Migration: rescue_stuck_evaluation_jobs
-- Purpose:
--   Independent batch rescue RPC for stuck evaluation jobs.
--
--   This function is the out-of-band safety net for the job execution layer.
--   It runs independently of the Vercel-hosted worker and watchdog handlers,
--   so it can rescue jobs even during a full deployment-level failure.
--
--   Selection criteria (a job is "stuck" when ALL of these are true):
--     1. status = 'running'
--     2. lease_until < now()              (lease has expired)
--     3. worker_pulse_at < now() - 5 min  (no recent worker activity)
--        OR worker_pulse_at IS NULL       (worker never started)
--     4. NOT (phase = 'review_gate' AND phase_status = 'awaiting_approval')
--        (Guard E: never rescue jobs waiting on author approval)
--
--   Rescue semantics are delegated entirely to the existing canonical
--   admin_rescue_orphaned_evaluation_job(uuid, text) RPC. This function
--   only owns candidate selection and iteration — it never duplicates
--   the rescue UPDATE logic.
--
--   Safety:
--     - Capped at p_max_jobs (default 20) per invocation
--     - Idempotent: running twice is safe (rescued jobs are no longer 'running')
--     - SECURITY DEFINER, service_role only
--
-- Caller: Supabase Edge Function (rescue-stuck-jobs), manual operator, or
--         any out-of-band scheduler with service_role access.

CREATE OR REPLACE FUNCTION public.rescue_stuck_evaluation_jobs(
  p_max_jobs  INTEGER  DEFAULT 20,
  p_reason    TEXT     DEFAULT 'independent_rescue:stuck_lease_expired'
)
RETURNS TABLE (
  rescued_id    UUID,
  phase         TEXT,
  phase_status  TEXT,
  rescued_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_stuck_id     UUID;
  v_cap          INTEGER;
  v_rescued      RECORD;
BEGIN
  -- Clamp cap to [1, 50] to prevent accidental mass operations
  v_cap := GREATEST(1, LEAST(COALESCE(p_max_jobs, 20), 50));

  FOR v_stuck_id IN
    SELECT j.id
    FROM public.evaluation_jobs j
    WHERE j.status = 'running'
      -- Lease must have expired
      AND j.lease_until IS NOT NULL
      AND j.lease_until < now()
      -- Worker pulse must be stale (>5 min) or never set
      AND (
        j.worker_pulse_at IS NULL
        OR j.worker_pulse_at < now() - interval '5 minutes'
      )
      -- Guard E: never rescue review_gate / awaiting_approval
      AND NOT (
        j.phase = 'review_gate'
        AND j.phase_status = 'awaiting_approval'
      )
    ORDER BY j.lease_until ASC  -- oldest expired lease first
    LIMIT v_cap
  LOOP
    -- Delegate to canonical single-job rescue RPC.
    -- This preserves all existing rescue semantics:
    --   - clears claimed_by, lease_token, lease_until, worker_pulse_at
    --   - sets status=queued, phase_status=queued
    --   - preserves phase (no rewind)
    --   - appends _rescue_event to progress JSONB
    --   - idempotent (second call is no-op)
    FOR v_rescued IN
      SELECT r.id AS rescued_id,
             r.phase,
             r.phase_status,
             r.rescued_at
      FROM public.admin_rescue_orphaned_evaluation_job(v_stuck_id, p_reason) r
    LOOP
      rescued_id   := v_rescued.rescued_id;
      phase        := v_rescued.phase;
      phase_status := v_rescued.phase_status;
      rescued_at   := v_rescued.rescued_at;
      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.rescue_stuck_evaluation_jobs(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rescue_stuck_evaluation_jobs(INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION public.rescue_stuck_evaluation_jobs(INTEGER, TEXT) IS
  'Independent batch rescue for stuck evaluation jobs. Finds running jobs with expired leases and stale/null worker pulses, then delegates each to admin_rescue_orphaned_evaluation_job. Skips review_gate/awaiting_approval jobs. Capped at p_max_jobs per call. Idempotent.';
