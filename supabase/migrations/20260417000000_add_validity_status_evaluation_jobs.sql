-- Migration: Add validity_status column and constrain canonical evaluation job states
-- Closes: Item #18.6 — DB truth layer for lifecycle/validity contracts
--
-- Purpose:
--   Make canonical contracts true at the database layer.
--   - status: canonical lifecycle (queued | running | complete | failed)
--   - validity_status: canonical validity (pending | valid | invalid | quarantined)
--
-- These remain separate:
--   - status answers: where is the job in execution?
--   - validity_status answers: is the completed evaluation releasable/trustworthy?

-- ============================================================
-- PRE-MIGRATION AUDIT
-- ============================================================

-- Capture distinct status values and counts before changes
-- Expected after normalization: queued, running, complete, failed (only)
-- SELECT status, COUNT(*)
-- FROM evaluation_jobs
-- GROUP BY status
-- ORDER BY status;

-- Capture if validity_status already exists and what values it contains
-- Expected: column does not exist yet, OR all NULLs if it was partially added
-- SELECT validity_status, COUNT(*)
-- FROM evaluation_jobs
-- GROUP BY validity_status
-- ORDER BY validity_status;

-- ============================================================
-- STEP 1: Add validity_status column
-- ============================================================

ALTER TABLE evaluation_jobs
ADD COLUMN IF NOT EXISTS validity_status text;

-- ============================================================
-- STEP 2: Normalize existing status values (defensive)
-- ============================================================

UPDATE evaluation_jobs
SET status = LOWER(TRIM(status))
WHERE status IS NOT NULL
  AND status != LOWER(TRIM(status));

-- ============================================================
-- STEP 3: Normalize validity_status values (defensive)
-- ============================================================

UPDATE evaluation_jobs
SET validity_status = LOWER(TRIM(validity_status))
WHERE validity_status IS NOT NULL
  AND validity_status != LOWER(TRIM(validity_status));

-- ============================================================
-- STEP 4: Backfill validity_status (conservative)
-- ============================================================
-- Policy: A failed execution did not produce a completed adjudicated output,
-- so 'pending' is more honest than inventing 'invalid' or 'quarantined'.
-- 
-- For complete jobs with no validity mapping: default to 'pending' (unadjudicated).
-- For failed/queued/running jobs: no adjudication has occurred; default 'pending'.

UPDATE evaluation_jobs
SET validity_status = 'pending'
WHERE validity_status IS NULL;

-- ============================================================
-- STEP 5: Set NOT NULL constraint
-- ============================================================

ALTER TABLE evaluation_jobs
ALTER COLUMN validity_status SET NOT NULL;

-- ============================================================
-- STEP 6: Add lifecycle CHECK constraint (status)
-- ============================================================
-- Constraint: status must be one of canonical lifecycle states

ALTER TABLE evaluation_jobs
DROP CONSTRAINT IF EXISTS evaluation_jobs_status_check;

ALTER TABLE evaluation_jobs
ADD CONSTRAINT evaluation_jobs_status_check
CHECK (status IN ('queued', 'running', 'complete', 'failed'));

-- ============================================================
-- STEP 7: Add validity CHECK constraint (validity_status)
-- ============================================================
-- Constraint: validity_status must be one of canonical validity states

ALTER TABLE evaluation_jobs
DROP CONSTRAINT IF EXISTS evaluation_jobs_validity_status_check;

ALTER TABLE evaluation_jobs
ADD CONSTRAINT evaluation_jobs_validity_status_check
CHECK (validity_status IN ('pending', 'valid', 'invalid', 'quarantined'));

-- ============================================================
-- POST-MIGRATION AUDIT
-- ============================================================
-- After migration, verify:
--
-- SELECT status, validity_status, COUNT(*)
-- FROM evaluation_jobs
-- GROUP BY status, validity_status
-- ORDER BY status, validity_status;
--
-- Expected lifecycle values: queued, running, complete, failed (only)
-- Expected validity values: pending, valid, invalid, quarantined (only)
--
-- SELECT DISTINCT status FROM evaluation_jobs ORDER BY status;
-- SELECT DISTINCT validity_status FROM evaluation_jobs ORDER BY validity_status;

COMMIT;
