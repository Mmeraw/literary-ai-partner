-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add phase_1a to evaluation_jobs.phase constraint
--
-- Context:
--   Multi-phase Vercel workflow: phase_1a is the Pass 1A character sweep phase.
--   Each phase gets its own Vercel invocation with a fresh 720s execution window.
--
--   Phase chain:
--     phase_1  → Pass 1 + Pass 2 → queued as phase_1a
--     phase_1a → Pass 1A char sweep → queued as phase_2
--     phase_2  → Pass 3 synthesis → queued as phase_3 (if WAVE eligible)
--     phase_3  → WAVE revision → complete
--
-- Actions:
--   1. Drop and recreate evaluation_jobs_phase_check to include 'phase_1a'.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_phase_check;

ALTER TABLE evaluation_jobs
  ADD CONSTRAINT evaluation_jobs_phase_check
    CHECK (phase IN ('phase_0', 'phase_1', 'phase_1a', 'phase_2', 'phase_3'));
