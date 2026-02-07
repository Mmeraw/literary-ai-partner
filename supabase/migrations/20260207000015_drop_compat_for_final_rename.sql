-- Drop compat overload (integer, timestamptz, text) for final parameter rename
-- Date: 2026-02-07
-- Purpose: Enable recreation with c_* parameter names to guarantee PostgREST
--          named-arg RPC calls resolve deterministically to canonical only

DROP FUNCTION IF EXISTS public.claim_job_atomic(INTEGER, TIMESTAMPTZ, TEXT);
