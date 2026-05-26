-- Migration: add review_gate (and wave_revision) to evaluation_jobs phase check constraint
--
-- The processor's phase_1a → review_gate transition was failing with:
--   "new row for relation "evaluation_jobs" violates check constraint
--    "evaluation_jobs_phase_check""
-- because the old constraint did not include 'review_gate'.
-- All three Phase 1A artifacts write successfully before this transition,
-- so this was a pure DB gate — not a pipeline logic failure.
--
-- Also adds 'wave_revision' which is already in the canonical phase enum
-- but was missing from the DB constraint.

ALTER TABLE evaluation_jobs DROP CONSTRAINT evaluation_jobs_phase_check;
ALTER TABLE evaluation_jobs ADD CONSTRAINT evaluation_jobs_phase_check
  CHECK (phase = ANY (ARRAY[
    'phase_0'::text,
    'phase_1'::text,
    'phase_1a'::text,
    'review_gate'::text,
    'phase_2'::text,
    'phase_3'::text,
    'wave_revision'::text
  ]));
