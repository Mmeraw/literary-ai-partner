-- Phase 2B: Atomic Transition Writer RPC
-- Single function for ALL state transitions. No direct mutation allowed.
BEGIN;

CREATE OR REPLACE FUNCTION transition_job_state(
  p_job_id uuid,
  p_to_state text,
  p_lease_token uuid DEFAULT NULL,
  p_trigger text DEFAULT 'worker',
  p_worker_id text DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_error_message text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_job evaluation_jobs%ROWTYPE;
  v_valid_transitions jsonb := '{
    "ingested": ["queued"],
    "queued": ["claimed"],
    "claimed": ["running", "failed", "cancelled"],
    "running": ["pass1", "failed", "cancelled"],
    "pass1": ["pass2", "failed"],
    "pass2": ["pass3", "failed"],
    "pass3": ["quality_gate", "failed"],
    "quality_gate": ["complete", "failed", "quarantined"],
    "failed": ["queued", "quarantined"],
    "quarantined": ["queued"]
  }'::jsonb;
  v_allowed jsonb;
  v_is_terminal boolean;
BEGIN
  -- Row lock
  SELECT * INTO v_job FROM evaluation_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'JOB_NOT_FOUND');
  END IF;

  -- Terminal state guard
  v_is_terminal := v_job.current_state IN ('complete', 'cancelled');
  IF v_is_terminal THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TERMINAL_STATE', 'current_state', v_job.current_state);
  END IF;

  -- Quarantine guard (only admin/replay can exit quarantine)
  IF v_job.current_state = 'quarantined' AND p_trigger NOT IN ('admin', 'replay') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'QUARANTINE_LOCKED', 'current_state', v_job.current_state);
  END IF;

  -- Lease validation (required for worker triggers, skip for admin/system/ingestion)
  IF p_trigger = 'worker' AND v_job.current_state NOT IN ('ingested', 'queued') THEN
    IF v_job.lease_token IS NULL OR v_job.lease_token != p_lease_token THEN
      RETURN jsonb_build_object('ok', false, 'error', 'LEASE_MISMATCH');
    END IF;
    IF v_job.lease_expires_at IS NOT NULL AND v_job.lease_expires_at < now() THEN
      RETURN jsonb_build_object('ok', false, 'error', 'LEASE_EXPIRED');
    END IF;
  END IF;

  -- Valid transition check
  v_allowed := v_valid_transitions -> v_job.current_state;
  IF v_allowed IS NULL OR NOT v_allowed ? p_to_state THEN
    RETURN jsonb_build_object('ok', false, 'error', 'INVALID_TRANSITION',
      'from', v_job.current_state, 'to', p_to_state);
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM transition_log WHERE job_id = p_job_id AND idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('ok', true, 'idempotent', true, 'state', p_to_state);
    END IF;
  END IF;

  -- Apply transition
  UPDATE evaluation_jobs SET
    previous_state = current_state,
    current_state = p_to_state,
    state_changed_at = now(),
    updated_at = now(),
    lease_worker_id = COALESCE(p_worker_id, lease_worker_id),
    failure_code = CASE WHEN p_to_state = 'failed' THEN p_error_code ELSE failure_code END,
    last_error = CASE WHEN p_to_state = 'failed' THEN p_error_message ELSE last_error END,
    failure_count = CASE WHEN p_to_state = 'failed' THEN failure_count + 1 ELSE failure_count END,
    last_failure_at = CASE WHEN p_to_state = 'failed' THEN now() ELSE last_failure_at END,
    retry_count = CASE WHEN p_to_state = 'queued' AND v_job.current_state = 'failed' THEN retry_count + 1 ELSE retry_count END,
    quarantine_reason = CASE WHEN p_to_state = 'quarantined' THEN p_error_message ELSE quarantine_reason END,
    quarantine_at = CASE WHEN p_to_state = 'quarantined' THEN now() ELSE quarantine_at END,
    status = CASE
      WHEN p_to_state = 'complete' THEN 'complete'
      WHEN p_to_state IN ('failed', 'quarantined') THEN 'failed'
      WHEN p_to_state = 'cancelled' THEN 'cancelled'
      WHEN p_to_state IN ('claimed', 'running', 'pass1', 'pass2', 'pass3', 'quality_gate') THEN 'running'
      ELSE 'queued'
    END
  WHERE id = p_job_id;

  -- Write transition log
  INSERT INTO transition_log (job_id, from_state, to_state, trigger, lease_token, idempotency_key, worker_id, metadata, error_code, error_message)
  VALUES (p_job_id, v_job.current_state, p_to_state, p_trigger, p_lease_token, p_idempotency_key, p_worker_id, p_metadata, p_error_code, p_error_message);

  RETURN jsonb_build_object('ok', true, 'from', v_job.current_state, 'to', p_to_state, 'job_id', p_job_id);
END;
$$;

COMMIT;
