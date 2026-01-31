-- Phase A.4: Strengthen claim_job_atomic invariants (drop-only migration)
-- Date: 2026-01-31
-- Purpose: Drop function to allow return-type change in follow-up migration

DROP FUNCTION IF EXISTS claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER);
