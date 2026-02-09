-- OBSERVABILITY_QUERIES_v1.sql
-- Phase C: Observability & Failure Envelope Proof
-- 
-- All queries in this file assume the Phase C D1 Failure Envelope is correctly populated.
-- These queries are used for D1 validation, D2 structured log auditing, and D3 operational observability.
--
-- Author: RevisionGrade Agent
-- Version: 1.0
-- Status: Ready for Phase C D1–D3 sign-off

---
--- ============================================================================
--- D1: FAILURE ENVELOPE DATA INTEGRITY CHECK
--- ============================================================================
---
--- Validates that all failed jobs have the mandatory failure envelope fields.
--- This is the foundation for observability and retry behavior.

-- Q0: Failed Jobs Missing Envelope Fields (should return 0 rows)
SELECT
  id,
  status,
  progress->>'failed_at' as failed_at,
  progress->>'failure_reason' as failure_reason,
  progress->>'attempt_count' as attempt_count
FROM jobs
WHERE status = 'failed'
AND (
  progress->>'failed_at' IS NULL
  OR progress->>'failure_reason' IS NULL
  OR progress->>'attempt_count' IS NULL
)
LIMIT 100;

-- Expected result: 0 rows (all failed jobs have required fields)
-- If > 0: D1 contract violation; investigate mapDbRowToJob() normalization


---
--- ============================================================================
--- D3: OBSERVABILITY CORE QUERIES
--- ============================================================================
---
--- Five essential queries for operational observability:
--- Q1 = Failure counts by failure_reason (event-based)
--- Q2 = Failure rate by job_type (event-based)
--- Q3 = Infra vs logic failure buckets (event-based)
--- Q4 = Latency percentiles
--- Q5 = Stuck jobs detection

-- NOTE: Q1–Q3 are now event-based using public.observability_events (Phase C D2)
--       Q4–Q5 remain job-table based until full lifecycle emit coverage is added.

-- Q1: Failure counts by failure_reason (last 24h, event-based)
SELECT
  payload->>'failure_reason' AS failure_reason,
  COUNT(*) AS failures,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM public.observability_events
WHERE event_type = 'job.failed'
  AND occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY failure_reason
ORDER BY failures DESC
LIMIT 10;

-- Q2: Failure rate by job_type (event-based, last 7 days)
SELECT
  payload #>> '{job,job_type}' AS job_type,
  COUNT(*) FILTER (WHERE event_type = 'job.failed') AS failed,
  COUNT(*) FILTER (WHERE event_type = 'job.completed') AS completed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type = 'job.failed')
    / NULLIF(
        COUNT(*) FILTER (WHERE event_type IN ('job.failed', 'job.completed')),
        0
      ),
    2
  ) AS failure_rate_pct
FROM public.observability_events
WHERE entity_type = 'job'
  AND event_type IN ('job.failed', 'job.completed')
  AND occurred_at > NOW() - INTERVAL '7 days'
GROUP BY job_type
ORDER BY failure_rate_pct DESC NULLS LAST;

-- Q3: Infra vs logic buckets (event-based, last 30 days)
SELECT
  CASE
    WHEN payload->>'failure_reason' ILIKE '%network%' THEN 'infra'
    WHEN payload->>'failure_reason' ILIKE '%timeout%' THEN 'infra'
    WHEN payload->>'failure_reason' ILIKE '%connection%' THEN 'infra'
    ELSE 'business_or_logic'
  END AS bucket,
  COUNT(*) AS ct
FROM public.observability_events
WHERE event_type = 'job.failed'
  AND occurred_at > NOW() - INTERVAL '30 days'
GROUP BY bucket
ORDER BY ct DESC;

-- Q4: Latency Percentiles (by job type)
SELECT
  job_type,
  COUNT(*) as total_jobs,
  ROUND(
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric,
    2
  ) as p50_sec,
  ROUND(
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric,
    2
  ) as p95_sec,
  ROUND(
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric,
    2
  ) as p99_sec,
  ROUND(
    MAX(EXTRACT(EPOCH FROM (completed_at - created_at)))::numeric,
    2
  ) as max_sec
FROM jobs
WHERE status IN ('complete', 'failed')
AND created_at > NOW() - INTERVAL '24 hours'
AND completed_at IS NOT NULL
GROUP BY job_type
ORDER BY p95_sec DESC NULLS LAST;

-- Q5: Stuck Jobs Detection (running for > N minutes)
SELECT
  id,
  job_type,
  status,
  started_at,
  ROUND(EXTRACT(EPOCH FROM (NOW() - started_at)) / 60.0, 2) as minutes_stuck,
  progress->>'phase' as phase,
  progress->>'phase_status' as phase_status,
  (progress->>'attempt_count')::int as attempt_count
FROM jobs
WHERE status = 'running'
AND started_at < NOW() - INTERVAL '5 minutes'
ORDER BY started_at ASC
LIMIT 20;

-- Q5 Interpretation:
-- If rows exist here, jobs are stalled. Check:
--   1. Are workers running? (daemon, processes, container logs)
--   2. Is the database connection alive?
--   3. Is the job lease held? (check progress->>'lease_held_until')


---
--- ============================================================================
--- D4: DEADLETTER INVENTORY
--- ============================================================================
---
--- View jobs that have exhausted all retries and are now in operator queue.

-- Q6: Deadletter Staging (failed jobs beyond MAX_RETRIES)
SELECT
  id,
  job_type,
  (progress->>'attempt_count')::int as attempt_count,
  progress->>'failure_reason' as error_code,
  progress->>'failure_message' as error_message,
  failed_at,
  progress->>'next_retry_at' IS NOT NULL as would_retry_if_budget_remained,
  CASE
    WHEN (progress->>'attempt_count')::int >= 5 THEN '🚨 EXHAUSTED'
    WHEN (progress->>'attempt_count')::int = 4 THEN '⚠️  NEAR_LIMIT'
    ELSE 'OK'
  END as deadline_status
FROM jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '7 days'
AND (progress->>'attempt_count')::int >= 3
ORDER BY failed_at DESC;

-- Configuration Note:
-- Update MAX_RETRIES value below to match your deployment:
-- Assume MAX_RETRIES = 5 for Q6 interpretation


---
--- ============================================================================
--- METADATA HELPER VIEWS (optional, for debugging)
--- ============================================================================

-- All distinct error codes in use (helps validate Phase A.1 taxonomy adherence)
SELECT DISTINCT
  progress->>'failure_reason' as error_code,
  COUNT(*) as count
FROM jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY error_code
ORDER BY count DESC;

-- Runtime metadata presence check (validates Phase 2C envelope)
SELECT
  COUNT(*) FILTER (WHERE progress->'provider_meta' IS NOT NULL) as has_provider_meta,
  COUNT(*) FILTER (WHERE progress->'openai_runtime' IS NOT NULL) as has_openai_runtime,
  COUNT(*) as total_jobs
FROM jobs
WHERE status = 'complete'
AND created_at > NOW() - INTERVAL '24 hours';

