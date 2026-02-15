-- Grant execute permission on hardened claim_job_atomic to authenticated and service_role
-- Date: 2026-02-15
-- Single-statement migration: Supabase CLI requires one command per prepared statement
GRANT EXECUTE ON FUNCTION public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) TO authenticated, service_role;
