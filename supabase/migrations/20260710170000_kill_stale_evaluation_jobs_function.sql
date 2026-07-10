-- Migration: kill_stale_evaluation_jobs()
-- Adds a DB function called at the top of every process-evaluations cron run.
-- Terminates jobs that have exceeded the 75-minute wall-clock limit OR
-- have exceeded the 8-retry cap, so they can never loop indefinitely and
-- burn OpenAI quota.
--
-- Parameters are configurable at call-time via env vars:
--   EVAL_JOB_MAX_RUNTIME_MINUTES (default: 75)
--   EVAL_JOB_MAX_RETRIES         (default: 8)

CREATE OR REPLACE FUNCTION kill_stale_evaluation_jobs(
  max_runtime_minutes integer DEFAULT 75,
  max_retries_allowed integer DEFAULT 8
)
RETURNS TABLE(killed_id uuid, kill_reason text) AS $$
BEGIN
  RETURN QUERY
  UPDATE evaluation_jobs
  SET
    status = 'failed',
    completed_at = NOW(),
    last_error = '[AutoKill] ' || CASE
      WHEN retry_count >= max_retries_allowed
        THEN 'Retry cap exceeded (' || retry_count || '/' || max_retries_allowed || ' retries)'
      WHEN created_at < NOW() - (max_runtime_minutes || ' minutes')::interval
        THEN 'Wall-clock timeout (' || max_runtime_minutes || 'min limit, ran ' ||
             ROUND(EXTRACT(EPOCH FROM (NOW() - created_at))/60)::text || 'min)'
      ELSE 'Unknown stale condition'
    END || ' killed_at=' || NOW()::text
  WHERE completed_at IS NULL
    AND status IN ('queued', 'running', 'failed', 'retrying')
    AND (
      retry_count >= max_retries_allowed
      OR created_at < NOW() - (max_runtime_minutes || ' minutes')::interval
    )
  RETURNING id, last_error;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION kill_stale_evaluation_jobs(integer, integer) TO service_role;
