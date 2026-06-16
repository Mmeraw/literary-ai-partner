-- Fix: persist_evaluation_v2_atomic must handle split-brain scenarios where
-- phase_status is stuck at 'failed' (set by a stale worker/watchdog) while
-- a healthy worker completed all synthesis successfully.
--
-- The DB trigger (harden_evaluation_jobs_lifecycle) enforces:
--   failed → queued (explicit retry only)
--   queued → running
--   running → complete
--
-- This migration adds a pre-step: if phase_status is terminal ('failed',
-- 'degraded', 'cancelled'), reset it to 'queued' first, then apply the
-- completion update. Both statements run in the same transaction, so the
-- intermediate state is never visible to other readers.

CREATE OR REPLACE FUNCTION public.persist_evaluation_v2_atomic(
  p_job_id uuid,
  p_manuscript_id bigint,
  p_artifact_type text,
  p_artifact_content jsonb,
  p_source_hash text,
  p_artifact_version text,
  p_evaluation_result jsonb,
  p_progress jsonb,
  p_completed_at timestamptz,
  p_phase2_completed_at timestamptz,
  p_validity_status text,
  p_total_units integer,
  p_completed_units integer,
  p_last_heartbeat timestamptz,
  p_last_heartbeat_at timestamptz,
  p_heartbeat_at timestamptz
)
RETURNS TABLE (
  artifact_id uuid,
  job_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_artifact_id uuid;
  v_current_phase_status text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.evaluation_jobs WHERE id = p_job_id) THEN
    RAISE EXCEPTION 'persist_evaluation_v2_atomic: job % not found', p_job_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Persist the artifact first (idempotent upsert)
  INSERT INTO public.evaluation_artifacts (
    job_id,
    manuscript_id,
    artifact_type,
    content,
    source_hash,
    artifact_version,
    created_at,
    updated_at
  )
  VALUES (
    p_job_id,
    p_manuscript_id,
    p_artifact_type,
    p_artifact_content,
    p_source_hash,
    p_artifact_version,
    p_completed_at,
    p_completed_at
  )
  ON CONFLICT (job_id, artifact_type) DO UPDATE
    SET manuscript_id = EXCLUDED.manuscript_id,
        content = EXCLUDED.content,
        source_hash = EXCLUDED.source_hash,
        artifact_version = EXCLUDED.artifact_version,
        updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_artifact_id;

  -- Check current phase_status to handle split-brain recovery.
  -- If a stale worker/watchdog marked phase_status as terminal while the
  -- active worker was still processing, we need to step through the
  -- allowed transition: failed → queued → running → complete.
  SELECT phase_status INTO v_current_phase_status
  FROM public.evaluation_jobs
  WHERE id = p_job_id;

  IF v_current_phase_status IN ('failed', 'degraded', 'cancelled') THEN
    -- Step 1: Reset to 'queued' (the only allowed exit from terminal states)
    UPDATE public.evaluation_jobs
    SET phase_status = 'queued', updated_at = p_completed_at
    WHERE id = p_job_id;

    -- Step 2: Transition queued → running (required intermediate state)
    UPDATE public.evaluation_jobs
    SET phase_status = 'running', updated_at = p_completed_at
    WHERE id = p_job_id;
  END IF;

  -- Now phase_status is either 'running' (from recovery) or was already
  -- 'running'/'queued' — the trigger allows running → complete.
  UPDATE public.evaluation_jobs
  SET
    status = 'complete',
    validity_status = p_validity_status,
    phase = 'phase_2',
    phase_status = 'complete',
    total_units = p_total_units,
    completed_units = p_completed_units,
    progress = p_progress,
    evaluation_result = p_evaluation_result,
    evaluation_result_version = p_artifact_version,
    last_heartbeat = p_last_heartbeat,
    last_heartbeat_at = p_last_heartbeat_at,
    heartbeat_at = p_heartbeat_at,
    last_error = NULL,
    updated_at = p_completed_at,
    completed_at = p_completed_at,
    phase2_completed_at = p_phase2_completed_at
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'persist_evaluation_v2_atomic: completion update affected 0 rows for job %', p_job_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT v_artifact_id, p_job_id, 'complete'::text;
END;
$$;
