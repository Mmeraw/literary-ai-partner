-- Migration: Grants for finalize_job_failure_atomic RPC
-- Purpose: Lock down execution to service_role only
-- Separated from function creation to avoid SQLSTATE 42601
-- in the Supabase CLI prepared-statement migration runner

REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)
  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)
  FROM authenticated;

GRANT EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)
  TO service_role;
