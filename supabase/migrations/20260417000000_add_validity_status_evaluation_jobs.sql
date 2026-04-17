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
ADD COLUMN IF NOT EXISTS validity_status text DEFAULT 'pending';

-- Ensure default is present even if the column already existed
ALTER TABLE evaluation_jobs
ALTER COLUMN validity_status SET DEFAULT 'pending';

-- ============================================================
-- STEP 2: Normalize existing status values (defensive)
-- ============================================================

UPDATE evaluation_jobs
SET status = LOWER(TRIM(status))
WHERE status IS NOT NULL
  AND status != LOWER(TRIM(status));

-- =========================================================================
-- STEP 2.5: Map legacy non-canonical lifecycle values to canonical set
-- =========================================================================
-- Context:
--   Prior to 18.6, evaluation_jobs.status had no DB-level CHECK constraint.
--   Historical rows may contain values outside the canonical lifecycle set
--   {queued, running, complete, failed}. Before adding the CHECK in Step 6,
--   we must map any legacy values to their canonical equivalents, or the
--   constraint addition will fail and leave the migration half-applied.
--
-- Mapping policy (conservative, lifecycle-only — no validity inference):
--   - 'completed'        -> 'complete'    (synonym; same lifecycle state)
--   - 'complete'         -> 'complete'    (no-op; already canonical)
--   - 'in_progress'      -> 'running'     (synonym)
--   - 'in-progress'      -> 'running'     (hyphen variant)
--   - 'inprogress'       -> 'running'     (concatenated variant)
--   - 'processing'       -> 'running'     (legacy worker vocabulary)
--   - 'pending'          -> 'queued'      (pre-claim state; NOT validity)
--   - 'waiting'          -> 'queued'
--   - 'error'            -> 'failed'      (error is an outcome, not a state)
--   - 'errored'          -> 'failed'
--   - 'cancelled'        -> 'failed'      (cancellation is a terminal non-success)
--   - 'canceled'         -> 'failed'      (US spelling variant)
--   - 'aborted'          -> 'failed'
--   - 'timeout'          -> 'failed'      (timeout is terminal; retry decided by FailureCode)
--   - 'timed_out'        -> 'failed'
--
-- Doctrinal notes:
--   - This step does NOT touch validity_status. Lifecycle and validity remain
--     separate contracts (see 18.R / 151 / 152).
--   - 'cancelled' maps to 'failed' at the lifecycle layer; if a distinct
--     cancelled FailureCode is desired later, that is a retry-policy change,
--     not a lifecycle expansion (out of scope for 18.6).
--   - Any value NOT in the mapping below will trip Step 6's CHECK. That is
--     intentional: unknown legacy vocabulary must be reviewed manually, not
--     silently remapped. See PRE-MIGRATION AUDIT output in PR body.
-- =========================================================================

-- Preview what will be remapped (run before UPDATE for the PR audit trail):
-- SELECT status AS legacy_status, COUNT(*) AS row_count
-- FROM evaluation_jobs
-- WHERE status NOT IN ('queued', 'running', 'complete', 'failed')
-- GROUP BY status
-- ORDER BY row_count DESC;

UPDATE evaluation_jobs
SET status = CASE status
    WHEN 'completed'    THEN 'complete'
    WHEN 'in_progress'  THEN 'running'
    WHEN 'in-progress'  THEN 'running'
    WHEN 'inprogress'   THEN 'running'
    WHEN 'processing'   THEN 'running'
    WHEN 'pending'      THEN 'queued'
    WHEN 'waiting'      THEN 'queued'
    WHEN 'error'        THEN 'failed'
    WHEN 'errored'      THEN 'failed'
    WHEN 'cancelled'    THEN 'failed'
    WHEN 'canceled'     THEN 'failed'
    WHEN 'aborted'      THEN 'failed'
    WHEN 'timeout'      THEN 'failed'
    WHEN 'timed_out'    THEN 'failed'
    ELSE status  -- canonical values pass through unchanged
END
WHERE status IN (
    'completed', 'in_progress', 'in-progress', 'inprogress', 'processing',
    'pending', 'waiting',
    'error', 'errored', 'cancelled', 'canceled', 'aborted',
    'timeout', 'timed_out'
);

-- Fail-fast guard: if ANY non-canonical values remain, abort the migration
-- with a clear error BEFORE Step 6 adds the CHECK and produces a cryptic
-- constraint-violation message.
DO $$
DECLARE
    bad_count integer;
    bad_values text;
BEGIN
    SELECT COUNT(*), string_agg(DISTINCT status, ', ')
    INTO bad_count, bad_values
    FROM evaluation_jobs
    WHERE status NOT IN ('queued', 'running', 'complete', 'failed');

    IF bad_count > 0 THEN
        RAISE EXCEPTION
            '18.6 migration aborted: % row(s) have non-canonical status values not covered by the Step 2.5 mapping: [%]. Extend the CASE expression in Step 2.5 with explicit mappings, or clean the rows manually, then re-run.',
            bad_count, bad_values;
    END IF;
END $$;

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
