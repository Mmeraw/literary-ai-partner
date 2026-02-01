-- A6: Admin list jobs RPC with filters and keyset pagination
-- 
-- Purpose: Provide stable, filterable pagination for admin job listing
-- Used by: GET /api/admin/jobs and /api/admin/dead-letter
--
-- Governance:
-- - Keyset pagination (cursor-based) prevents duplicates/skipping under concurrent writes
-- - Service role only (enforced by RLS)
-- - Deterministic ordering: status + failed_at DESC + created_at DESC + id

CREATE OR REPLACE FUNCTION admin_list_jobs(
  p_status TEXT DEFAULT NULL,
  p_job_type TEXT DEFAULT NULL,
  p_phase TEXT DEFAULT NULL,
  p_policy_family TEXT DEFAULT NULL,
  p_created_after TIMESTAMPTZ DEFAULT NULL,
  p_created_before TIMESTAMPTZ DEFAULT NULL,
  p_failed_after TIMESTAMPTZ DEFAULT NULL,
  p_failed_before TIMESTAMPTZ DEFAULT NULL,
  p_cursor_failed_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_created_at TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  manuscript_id BIGINT,
  job_type TEXT,
  status TEXT,
  phase TEXT,
  phase_status TEXT,
  attempt_count INT,
  max_attempts INT,
  failed_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  last_error JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  work_type TEXT,
  policy_family TEXT,
  has_more BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_limit INT;
BEGIN
  -- Enforce maximum limit
  v_limit := LEAST(p_limit, 100);

  -- Build filtered query with keyset pagination
  RETURN QUERY
  WITH filtered_jobs AS (
    SELECT
      j.id,
      j.manuscript_id,
      j.job_type,
      j.status,
      j.phase,
      (j.progress ->> 'phase_status')::TEXT AS phase_status,
      j.attempt_count,
      j.max_attempts,
      j.failed_at,
      j.next_attempt_at,
      CASE 
        WHEN j.last_error IS NOT NULL THEN to_jsonb(j.last_error)
        ELSE NULL
      END AS last_error,
      j.created_at,
      j.updated_at,
      j.work_type,
      j.policy_family
    FROM evaluation_jobs j
    WHERE
      -- Filter: status
      (p_status IS NULL OR j.status = p_status)
      -- Filter: job_type
      AND (p_job_type IS NULL OR j.job_type = p_job_type)
      -- Filter: phase
      AND (p_phase IS NULL OR j.phase = p_phase)
      -- Filter: policy_family
      AND (p_policy_family IS NULL OR j.policy_family = p_policy_family)
      -- Filter: created_at range
      AND (p_created_after IS NULL OR j.created_at >= p_created_after)
      AND (p_created_before IS NULL OR j.created_at <= p_created_before)
      -- Filter: failed_at range
      AND (p_failed_after IS NULL OR j.failed_at >= p_failed_after)
      AND (p_failed_before IS NULL OR j.failed_at <= p_failed_before)
      -- Keyset pagination (resume after cursor)
      AND (
        p_cursor_id IS NULL
        OR (
          -- For failed jobs: ORDER BY failed_at DESC NULLS LAST, created_at DESC, id
          (j.failed_at, j.created_at, j.id) < 
          (p_cursor_failed_at, p_cursor_created_at, p_cursor_id)
        )
      )
    -- Deterministic sort: failed_at DESC (nulls last), created_at DESC, id
    ORDER BY
      j.failed_at DESC NULLS LAST,
      j.created_at DESC,
      j.id
    LIMIT v_limit + 1  -- Fetch +1 to detect has_more
  ),
  paginated_jobs AS (
    SELECT 
      fj.*,
      ROW_NUMBER() OVER () AS rn
    FROM filtered_jobs fj
  )
  SELECT
    pj.id,
    pj.manuscript_id,
    pj.job_type,
    pj.status,
    pj.phase,
    pj.phase_status,
    pj.attempt_count,
    pj.max_attempts,
    pj.failed_at,
    pj.next_attempt_at,
    pj.last_error,
    pj.created_at,
    pj.updated_at,
    pj.work_type,
    pj.policy_family,
    (SELECT COUNT(*) > v_limit FROM filtered_jobs) AS has_more
  FROM paginated_jobs pj
  WHERE pj.rn <= v_limit;
END;
$$;

-- Grant execute to service role only
REVOKE ALL ON FUNCTION admin_list_jobs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_list_jobs TO service_role;

COMMENT ON FUNCTION admin_list_jobs IS 'A6: Admin job listing with filters and keyset pagination. Service role only.';
