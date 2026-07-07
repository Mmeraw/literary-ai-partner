-- =============================================================================
-- Migration: Re-assert canonical persist_evaluation_v2_atomic
-- Date: 2026-07-07
-- Purpose:
--   A manual dashboard deployment on 2026-07-07 (migration 20260707190618)
--   re-applied the broken intermediate function body from 20260610030000, which
--   sets phase_status = 'running' without updating status, violating the
--   harden_evaluation_jobs_lifecycle trigger.
--
--   This migration re-asserts the canonical function body originally defined in
--   20260613174500_reassert_atomic_persist_terminal_recovery.sql, ensuring it
--   is the final definition in migration order.
--
--   The canonical path is:
--     failed/degraded/cancelled → queued → running → complete
--   with status and phase_status kept synchronized at every step, a FOR UPDATE
--   row lock on the opening SELECT, and claimed_by/lease_token/worker_id cleared
--   on completion.
--
-- Governance:
--   - Do not weaken trigger_enforce_evaluation_job_phase_status_transition.
--   - Do not bypass lifecycle checks.
--   - Keep completion and artifact persistence in one transaction.
-- =============================================================================

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
  SELECT phase_status
  INTO v_current_phase_status
  FROM public.evaluation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'persist_evaluation_v2_atomic: job % not found', p_job_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Persist artifact first. The whole function is transactional, so if any later
  -- lifecycle transition fails, this write rolls back too.
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

  -- Split-brain recovery: terminal phase_status may only exit to queued.
  -- Keep status and phase_status consistent while stepping through the legal
  -- transition chain. The temporary running row must also satisfy
  -- evaluation_jobs_running_requires_claim, so the RPC owns a short synthetic
  -- recovery claim and clears it in the final completion update.
  IF v_current_phase_status IN ('failed', 'degraded', 'cancelled') THEN
    UPDATE public.evaluation_jobs
    SET
      phase_status = 'queued',
      status = 'queued',
      updated_at = p_completed_at
    WHERE id = p_job_id;

    v_current_phase_status := 'queued';
  END IF;

  -- Normalize queued/non-started jobs through running before completion.
  IF v_current_phase_status IN ('queued', 'not_started') THEN
    UPDATE public.evaluation_jobs
    SET
      phase_status = 'running',
      status = 'running',
      claimed_by = 'persist_evaluation_v2_atomic:terminal_recovery',
      claimed_at = p_completed_at,
      lease_token = gen_random_uuid(),
      lease_until = p_completed_at + interval '5 minutes',
      worker_id = 'persist_evaluation_v2_atomic:terminal_recovery',
      updated_at = p_completed_at
    WHERE id = p_job_id;

    v_current_phase_status := 'running';
  END IF;

  -- Complete only from a legal running/awaiting_approval state. The trigger still
  -- enforces this; this guard makes failures explicit and easier to diagnose.
  IF v_current_phase_status NOT IN ('running', 'awaiting_approval', 'complete', 'completed') THEN
    RAISE EXCEPTION 'persist_evaluation_v2_atomic: illegal pre-completion phase_status % for job %',
      v_current_phase_status, p_job_id
      USING ERRCODE = 'P0001';
  END IF;

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
    phase2_completed_at = p_phase2_completed_at,
    claimed_by = NULL,
    claimed_at = NULL,
    lease_token = NULL,
    lease_until = NULL,
    worker_id = NULL
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'persist_evaluation_v2_atomic: completion update affected 0 rows for job %', p_job_id
      USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT v_artifact_id, p_job_id, 'complete'::text;
END;
$$;

GRANT EXECUTE ON FUNCTION public.persist_evaluation_v2_atomic(
  uuid,
  bigint,
  text,
  jsonb,
  text,
  text,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  text,
  integer,
  integer,
  timestamptz,
  timestamptz,
  timestamptz
) TO service_role;
