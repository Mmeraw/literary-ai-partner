-- Migration: allow awaiting_approval in evaluation_jobs_status_phase_consistent
--
-- The processor's phase_1a → review_gate transition sets:
--   status='queued', phase='review_gate', phase_status='awaiting_approval'
--
-- The old constraint only allowed phase_status IN (NULL, 'queued', 'triggered')
-- when status='queued', so the write was rejected with a check constraint violation.
--
-- This migration expands the allowed set to include 'awaiting_approval' for both
-- status='queued' (review_gate hard-stop: worker cannot claim) and status='running'
-- (defensive: in case a future path keeps status=running at the gate).
--
-- Already applied to production (xtumxjnzdswuumndcbwc).

ALTER TABLE evaluation_jobs DROP CONSTRAINT evaluation_jobs_status_phase_consistent;
ALTER TABLE evaluation_jobs ADD CONSTRAINT evaluation_jobs_status_phase_consistent CHECK (
  -- Normal pipeline states
  (status = 'queued'   AND (phase_status IS NULL OR phase_status = ANY (ARRAY['queued', 'triggered', 'awaiting_approval'])))
  OR (status = 'running'  AND phase_status = ANY (ARRAY['running', 'awaiting_approval']))
  OR (status = 'complete' AND phase_status = 'complete')
  OR (status = 'failed'   AND phase_status = 'failed')
);
