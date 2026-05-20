-- Fix HTTP 300: PostgREST returns "multiple choices" when worker POSTs
-- {p_batch_size, p_worker_id, p_lease_token, p_lease_expires_at} because
-- both 4-arg overloads match. Drop the one with reversed arg order since
-- no caller ever invokes it with (p_worker_id, p_lease_token, p_lease_expires_at, p_batch_size).
DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(
  p_worker_id text,
  p_lease_token uuid,
  p_lease_expires_at timestamp with time zone,
  p_batch_size integer
);
