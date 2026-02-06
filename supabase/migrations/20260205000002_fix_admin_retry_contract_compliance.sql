-- Fix admin_retry_job: Retry-as-new-job pattern (contract-compliant)
-- Date: 2026-02-05
-- Contract: JOB_CONTRACT_v1 §3.2 - terminal means terminal unless NEW job created
--
-- CRITICAL FIX: Stop resurrecting failed jobs.
--
-- Before: UPDATE status='queued' WHERE status='failed'  -- resurrection (illegal)
-- After:  INSERT new job row with retry_of_job_id link  -- contract-compliant
--
-- This preserves:
--   - Failed jobs remain failed (terminal)
--   - Audit trail (old job shows failure, new job shows retry)
--   - Retry count tracking
--   - All transition rules (new job starts at 'queued')

BEGIN;

-- Drop the old version so we can change the return type safely.
DROP FUNCTION IF EXISTS public.admin_retry_job(uuid);

CREATE OR REPLACE FUNCTION public.admin_retry_job(p_job_id UUID)
RETURNS TABLE (
  new_job_id      UUID,
  original_job_id UUID,
  status          TEXT,
  retry_count     INT,
  created         BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original_job evaluation_jobs%ROWTYPE;
  v_new_job_id   UUID;
  v_retry_count  INT;
BEGIN
  -- Step 1: Fetch the original (failed) job.
  SELECT * INTO v_original_job
  FROM public.evaluation_jobs
  WHERE id = p_job_id
    AND status IN ('failed', 'dead_lettered')
    AND (lease_until IS NULL OR lease_until <= now())
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Job not found, not failed, or still leased.
    RETURN QUERY
    SELECT
      NULL::UUID AS new_job_id,
      p_job_id    AS original_job_id,
      COALESCE(
        (SELECT j.status FROM public.evaluation_jobs j WHERE j.id = p_job_id),
        'not_found'
      )           AS status,
      0           AS retry_count,
      FALSE       AS created;
    RETURN;
  END IF;

  -- Step 2: Calculate retry count.
  -- Count how many retries already exist for this job chain.
  WITH RECURSIVE retry_chain AS (
    -- Start with jobs that retry this one.
    SELECT id, retry_of_job_id, 1 AS depth
    FROM public.evaluation_jobs
    WHERE retry_of_job_id = p_job_id

    UNION ALL

    -- Follow the chain.
    SELECT e.id, e.retry_of_job_id, rc.depth + 1
    FROM public.evaluation_jobs e
    INNER JOIN retry_chain rc ON e.retry_of_job_id = rc.id
  )
  SELECT COALESCE(MAX(depth), 0) INTO v_retry_count
  FROM retry_chain;

  -- Step 3: Create NEW job (retry-as-new-job pattern).
  -- JOB_CONTRACT_v1 §3.2: "unless a new job is created".
  INSERT INTO public.evaluation_jobs (
    manuscript_id,
    job_type,
    policy_family,
    voice_preservation_level,
    english_variant,
    work_type,
    phase,
    status,          -- always 'queued' (§6.1)
    retry_of_job_id, -- link to original
    retry_count,     -- track retry depth
    last_error,      -- reset error state
    next_attempt_at, -- ready to claim immediately
    created_at,
    updated_at
  )
  VALUES (
    v_original_job.manuscript_id,
    v_original_job.job_type,
    v_original_job.policy_family,
    v_original_job.voice_preservation_level,
    v_original_job.english_variant,
    v_original_job.work_type,
    v_original_job.phase,
    'queued',        -- contract-compliant creation (§6.1)
    p_job_id,        -- retry link
    v_retry_count + 1,
    NULL,            -- fresh start (no inherited error)
    now(),           -- immediately claimable
    now(),
    now()
  )
  RETURNING id INTO v_new_job_id;

  -- Step 4: Return result.
  RETURN QUERY
  SELECT
    v_new_job_id            AS new_job_id,
    p_job_id                AS original_job_id,
    'queued'::TEXT          AS status,
    v_retry_count + 1       AS retry_count,
    TRUE                    AS created;
END;
$$;

COMMIT;
