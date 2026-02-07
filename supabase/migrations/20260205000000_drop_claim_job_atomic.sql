-- Drop claim_job_atomic to allow return type change
-- This must be separate from CREATE to avoid statement parsing issues
DROP FUNCTION IF EXISTS public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) CASCADE;
