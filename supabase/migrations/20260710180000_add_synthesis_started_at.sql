-- GATE 2: Add synthesis_started_at column to evaluation_jobs.
-- This column records the wall-clock timestamp when the DREAM synthesis
-- stage first began (across all invocations), enabling cumulative budget
-- accounting for Gates 2, 3, and 4.
-- The UPDATE in process-dream/route.ts uses WHERE synthesis_started_at IS NULL
-- so this is a first-write-wins anchor that survives worker restarts.
ALTER TABLE evaluation_jobs
  ADD COLUMN IF NOT EXISTS synthesis_started_at timestamptz;

COMMENT ON COLUMN evaluation_jobs.synthesis_started_at IS
  'Wall-clock timestamp of when DREAM synthesis first started. Used for cumulative synthesis budget accounting across all invocations (Gate 2/4).';
