-- Disambiguate claim_job_atomic overloads for named-arg RPC calls
-- Date: 2026-02-07
-- Purpose: drop existing compat overload so it can be recreated with renamed params
-- Note: single-statement migration required for Supabase prepared statements

DROP FUNCTION IF EXISTS public.claim_job_atomic(INTEGER, TIMESTAMPTZ, TEXT);