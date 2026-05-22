-- Migration: Relax enforce_evaluation_jobs_status_phase_consistent trigger
-- Context:
--   The original trigger only permitted exact status+phase_status pairs:
--     queued  → queued | triggered
--     running → running
--     complete → complete
--     failed   → failed
--
--   This blocked admin resets where we need to re-queue a job that has
--   already advanced through phases (e.g. reset a failed Phase 3 job back
--   to queued so the worker can resume from its existing handoff artifact).
--   Any attempt to SET status='queued' with phase_status='phase_2_complete'
--   (or any mid-pipeline phase_status) would raise an exception.
--
-- Fix:
--   Allow status='queued' with ANY phase_status value. This preserves the
--   invariant that running/complete/failed must have matching phase_status,
--   while giving admins a safe re-queue path at any pipeline checkpoint.
--
--   Also adds status='queued' + phase_status='resetting' as an explicit
--   documented pair for future admin tooling.
--
-- Safety:
--   - The worker routes on job.phase (the DB column), not phase_status.
--     Re-queuing with a mid-pipeline phase_status is safe because the
--     processor reads job.phase to decide execution entry point.
--   - running/complete/failed constraints are UNCHANGED — no relaxation
--     of the invariants that protect in-flight or terminal jobs.

CREATE OR REPLACE FUNCTION public.enforce_evaluation_jobs_status_phase_consistent()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NOT (
    -- queued: allow any phase_status (admin resets, mid-pipeline re-queues,
    --         and all standard pre-claim states like queued/triggered/resetting)
    (NEW.status = 'queued') OR

    -- running: must match exactly — worker owns this transition
    (NEW.status = 'running'  AND NEW.phase_status = 'running') OR

    -- complete: must match exactly — finalizer owns this transition
    (NEW.status = 'complete' AND NEW.phase_status = 'complete') OR

    -- failed: must match exactly — failure handler owns this transition
    (NEW.status = 'failed'   AND NEW.phase_status = 'failed')
  ) THEN
    RAISE EXCEPTION 'evaluation_jobs status/phase_status inconsistent: status=%, phase_status=%',
      NEW.status, NEW.phase_status;
  END IF;
  RETURN NEW;
END;
$function$;

-- Verify the trigger binding still points to this function
-- (trigger itself does not change, only the function body above)
-- DO $$ BEGIN
--   ASSERT EXISTS (
--     SELECT 1 FROM pg_trigger t
--     JOIN pg_proc p ON p.oid = t.tgfoid
--     WHERE t.tgrelid = 'evaluation_jobs'::regclass
--       AND p.proname = 'enforce_evaluation_jobs_status_phase_consistent'
--   ), 'Trigger binding missing — re-attach manually';
-- END $$;
