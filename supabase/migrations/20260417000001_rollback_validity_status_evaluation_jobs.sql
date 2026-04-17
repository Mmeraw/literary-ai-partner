-- =========================================================================
-- Rollback Migration: Revert 18.6 — validity_status + canonical CHECKs
-- =========================================================================
-- Companion to: 20260417000000_add_validity_status_evaluation_jobs.sql
--
-- Purpose:
--   Reverse the DB-layer changes introduced by 18.6 if the forward migration
--   causes downstream breakage in staging or production. Use only as an
--   emergency operator path — NOT a routine workflow.
--
-- What this reverses:
--   1. DROP CHECK constraint evaluation_jobs_validity_status_check
--   2. DROP CHECK constraint evaluation_jobs_status_check
--      (restores pre-18.6 state: no lifecycle CHECK on status)
--   3. DROP NOT NULL on validity_status
--   4. DROP DEFAULT on validity_status
--   5. DROP COLUMN validity_status
--
-- What this does NOT reverse:
--   - The Step 2.5 legacy-value remapping (e.g. 'completed' -> 'complete').
--     That data change is left in place intentionally; reverting it would
--     resurrect non-canonical vocabulary and violate runtime expectations
--     in code paths shipped by 18.R / 151 / 152.
--   - TypeScript JobRecord type changes — those must be reverted in code
--     via a follow-up revert PR, not via SQL.
--
-- Operator checklist before running:
--   [ ] Confirm 18.6 forward migration is the actual root cause, not a
--       downstream code change.
--   [ ] Snapshot evaluation_jobs table (pg_dump) before executing.
--   [ ] Coordinate with any in-flight workers; validity_status reads will
--       start returning undefined after column drop.
--   [ ] File a follow-up issue documenting why rollback was needed so 18.6
--       can be re-landed correctly.
-- =========================================================================

-- PRE-ROLLBACK AUDIT (uncomment to run):
-- -- Capture current validity_status distribution so we know what we're losing.
-- SELECT validity_status, COUNT(*)
-- FROM evaluation_jobs
-- GROUP BY validity_status
-- ORDER BY validity_status;
--
-- -- Capture current status distribution to confirm canonical set is intact
-- -- before we drop the CHECK.
-- SELECT status, COUNT(*)
-- FROM evaluation_jobs
-- GROUP BY status
-- ORDER BY status;

-- -------------------------------------------------------------------------
-- STEP 1: Drop validity_status CHECK constraint
-- -------------------------------------------------------------------------
ALTER TABLE evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_validity_status_check;

-- -------------------------------------------------------------------------
-- STEP 2: Drop status CHECK constraint
-- -------------------------------------------------------------------------
-- Note: pre-18.6 had no status CHECK. We do not restore a prior constraint
-- because none existed. If one is later desired, add it in a fresh migration.
ALTER TABLE evaluation_jobs
  DROP CONSTRAINT IF EXISTS evaluation_jobs_status_check;

-- -------------------------------------------------------------------------
-- STEP 3: Drop NOT NULL on validity_status (defensive; column drop follows)
-- -------------------------------------------------------------------------
-- Safe no-op if column is already gone, but guards against a partial rollback
-- where Step 5 was skipped.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'evaluation_jobs'
          AND column_name = 'validity_status'
    ) THEN
        ALTER TABLE evaluation_jobs
          ALTER COLUMN validity_status DROP NOT NULL;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- STEP 4: Drop DEFAULT on validity_status (defensive)
-- -------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'evaluation_jobs'
          AND column_name = 'validity_status'
    ) THEN
        ALTER TABLE evaluation_jobs
          ALTER COLUMN validity_status DROP DEFAULT;
    END IF;
END $$;

-- -------------------------------------------------------------------------
-- STEP 5: Drop validity_status column
-- -------------------------------------------------------------------------
ALTER TABLE evaluation_jobs
  DROP COLUMN IF EXISTS validity_status;

-- -------------------------------------------------------------------------
-- POST-ROLLBACK VERIFICATION (uncomment to run):
-- -------------------------------------------------------------------------
-- -- Confirm column is gone.
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'evaluation_jobs'
--   AND column_name = 'validity_status';
-- -- Expected: zero rows.
--
-- -- Confirm constraints are gone.
-- SELECT conname
-- FROM pg_constraint
-- WHERE conrelid = 'evaluation_jobs'::regclass
--   AND conname IN (
--       'evaluation_jobs_status_check',
--       'evaluation_jobs_validity_status_check'
--   );
-- -- Expected: zero rows.
