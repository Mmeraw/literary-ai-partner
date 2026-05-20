-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: add phase_3 to evaluation_jobs.phase constraint
--
-- Context:
--   WAVE Phase 3 runs automatically after a successful evaluation when:
--     • manuscript_words >= 25,000
--     • all 13 criteria score_0_10 >= 6.0 (no red criteria)
--
--   The processor sets phase = 'phase_3' and status = 'queued' to hand off
--   to the WAVE Revision Engine. This migration enables that transition.
--
-- Actions:
--   1. Drop the duplicate constraint evaluation_jobs_phase_chk (identical to
--      evaluation_jobs_phase_check — was created by a prior migration run twice).
--   2. Drop and recreate evaluation_jobs_phase_check to include 'phase_3'.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the duplicate constraint (safe — evaluation_jobs_phase_check remains)
ALTER TABLE evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_phase_chk;

-- Step 2: Drop the primary phase constraint so we can recreate it with phase_3
ALTER TABLE evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_phase_check;

-- Step 3: Recreate with phase_3 included
ALTER TABLE evaluation_jobs
  ADD CONSTRAINT evaluation_jobs_phase_check
    CHECK (phase IN ('phase_0', 'phase_1', 'phase_2', 'phase_3'));
