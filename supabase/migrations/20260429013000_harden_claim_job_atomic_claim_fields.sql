-- Align claim_job_atomic with canonical running-claim invariant fields.
-- Ensures running rows set BOTH ownership markers and BOTH lease expiry fields.

CREATE OR REPLACE FUNCTION public.claim_job_atomic(
  p_worker_id TEXT,
  p_now TIMESTAMPTZ,
  p_lease_seconds INTEGER DEFAULT 300
)
RETURNS TABLE (
  id UUID,
  manuscript_id BIGINT,
  job_type TEXT,
  policy_family TEXT,
  voice_preservation_level TEXT,
  english_variant TEXT,
  work_type TEXT,
  phase TEXT,
  status TEXT,
  worker_id TEXT,
  lease_token UUID,
  lease_until TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $claim_job_atomic_hardened$
DECLARE
  v_job_id UUID;
  v_clamped_ttl INTEGER;
  v_lease_until TIMESTAMPTZ;
BEGIN
  IF p_worker_id IS NULL OR p_worker_id = '' THEN
    RETURN;
  END IF;

  v_clamped_ttl := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 900));
  v_lease_until := p_now + make_interval(secs => v_clamped_ttl);

  SELECT j.id INTO v_job_id
  FROM public.evaluation_jobs j
  WHERE j.status = 'queued'
    AND (j.lease_until IS NULL OR j.lease_until < p_now)
    AND (j.next_attempt_at IS NULL OR j.next_attempt_at <= p_now)
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evaluation_jobs j
  SET
    status = 'running',
    claimed_by = p_worker_id,
    worker_id = p_worker_id,
    lease_token = gen_random_uuid(),
    lease_until = v_lease_until,
    lease_expires_at = v_lease_until,
    heartbeat_at = p_now,
    started_at = COALESCE(j.started_at, p_now),
    updated_at = p_now,
    next_attempt_at = NULL
  WHERE j.id = v_job_id
    AND j.status = 'queued';

  RETURN QUERY
  SELECT
    j.id,
    j.manuscript_id,
    j.job_type,
    j.policy_family,
    j.voice_preservation_level,
    j.english_variant,
    j.work_type,
    j.phase,
    j.status,
    j.worker_id,
    j.lease_token,
    j.lease_until,
    j.heartbeat_at,
    j.started_at
  FROM public.evaluation_jobs j
  WHERE j.id = v_job_id;
END;
$claim_job_atomic_hardened$;

COMMENT ON FUNCTION public.claim_job_atomic(TEXT, TIMESTAMPTZ, INTEGER) IS
  'Atomic queue claim: queued -> running. Writes claimed_by+worker_id and lease_token+lease_until+lease_expires_at for contract consistency.';
