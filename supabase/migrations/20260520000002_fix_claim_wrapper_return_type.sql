DROP FUNCTION IF EXISTS public.claim_evaluation_jobs(integer, text, integer);

CREATE FUNCTION public.claim_evaluation_jobs(
  p_batch_size integer DEFAULT 5,
  p_worker_id text DEFAULT NULL::text,
  p_lease_seconds integer DEFAULT 300
)
RETURNS TABLE(
  id uuid,
  manuscript_id bigint,
  job_type text,
  policy_family text,
  voice_preservation_level text,
  english_variant text,
  work_type text,
  phase text,
  status text,
  claimed_by text,
  worker_id text,
  lease_token uuid,
  lease_until timestamp with time zone,
  heartbeat_at timestamp with time zone,
  started_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
    RAISE EXCEPTION 'claim_evaluation_jobs: p_worker_id must not be null or empty';
  END IF;
  RETURN QUERY
    SELECT * FROM public.claim_job_atomic(p_worker_id, NOW(), p_lease_seconds);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, integer) TO authenticated;
