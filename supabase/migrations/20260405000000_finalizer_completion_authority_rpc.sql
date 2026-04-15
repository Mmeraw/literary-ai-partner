-- Migration: Finalizer atomic completion authority RPCs
-- Purpose: Install a single transactional boundary for terminal finalizer writes.
-- Scope: #89 write-authority only
CREATE OR REPLACE FUNCTION public.finalizer_complete_job_atomic(
  p_job_id uuid,
  p_worker_id text,
  p_canonical_artifact_type text,
  p_summary_artifact_type text,
  p_canonical_content jsonb,
  p_summary_content_without_canonical_id jsonb
)
RETURNS TABLE(canonical_artifact_id uuid, summary_artifact_id uuid)
LANGUAGE plpgsql
AS $finalizer_complete$
DECLARE
  v_job public.evaluation_jobs%ROWTYPE;
  v_phase text;
  v_claim_lease_id text;
  v_lease_expires_at_raw text;
  v_lease_expires_at timestamptz;
  v_now timestamptz := now();
  v_canonical_id uuid;
  v_summary_id uuid;
  v_summary_content jsonb;
  v_progress jsonb;
BEGIN
  SELECT *
  INTO v_job
  FROM public.evaluation_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % not found', p_job_id;
  END IF;

  IF v_job.status IN ('complete', 'failed') THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % already terminal (%)', p_job_id, v_job.status;
  END IF;

  IF v_job.status <> 'running' THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % status must be running (got %)', p_job_id, v_job.status;
  END IF;

  v_phase := COALESCE(v_job.progress->>'phase', v_job.phase, '');
  IF v_phase <> 'finalizer' THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % phase must be finalizer (got %)', p_job_id, v_phase;
  END IF;

  v_claim_lease_id := COALESCE(v_job.progress->>'lease_id', '');
  IF v_claim_lease_id = '' OR v_claim_lease_id <> p_worker_id THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % claim mismatch (expected %, got %)', p_job_id, p_worker_id, v_claim_lease_id;
  END IF;

  v_lease_expires_at_raw := COALESCE(v_job.progress->>'lease_expires_at', '');
  IF v_lease_expires_at_raw = '' THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % missing lease_expires_at', p_job_id;
  END IF;

  BEGIN
    v_lease_expires_at := v_lease_expires_at_raw::timestamptz;
  EXCEPTION
    WHEN others THEN
      RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % has invalid lease_expires_at (%)', p_job_id, v_lease_expires_at_raw;
  END;

  IF v_lease_expires_at <= v_now THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % lease expired at %', p_job_id, v_lease_expires_at_raw;
  END IF;

  INSERT INTO public.evaluation_artifacts (
    job_id,
    manuscript_id,
    artifact_type,
    artifact_version,
    content,
    source_phase,
    source_hash,
    updated_at
  ) VALUES (
    p_job_id,
    v_job.manuscript_id,
    p_canonical_artifact_type,
    'v1',
    p_canonical_content,
    'finalizer',
    NULL,
    v_now
  )
  RETURNING id INTO v_canonical_id;

  v_summary_content := jsonb_set(
    p_summary_content_without_canonical_id,
    '{canonical_artifact_id}',
    to_jsonb(v_canonical_id::text),
    true
  );

  INSERT INTO public.evaluation_artifacts (
    job_id,
    manuscript_id,
    artifact_type,
    artifact_version,
    content,
    source_phase,
    source_hash,
    updated_at
  ) VALUES (
    p_job_id,
    v_job.manuscript_id,
    p_summary_artifact_type,
    'v1',
    v_summary_content,
    'finalizer',
    NULL,
    v_now
  )
  RETURNING id INTO v_summary_id;

  v_progress := COALESCE(v_job.progress, '{}'::jsonb);
  v_progress := jsonb_set(v_progress, '{canonical_artifact_id}', to_jsonb(v_canonical_id::text), true);
  v_progress := jsonb_set(v_progress, '{summary_artifact_id}', to_jsonb(v_summary_id::text), true);
  v_progress := jsonb_set(v_progress, '{terminal_at}', to_jsonb(v_now::text), true);
  v_progress := jsonb_set(v_progress, '{phase_status}', '"complete"'::jsonb, true);
  v_progress := jsonb_set(v_progress, '{lease_id}', 'null'::jsonb, true);
  v_progress := jsonb_set(v_progress, '{lease_expires_at}', 'null'::jsonb, true);

  UPDATE public.evaluation_jobs
  SET
    status = 'complete',
    last_error = NULL,
    progress = v_progress,
    updated_at = v_now
  WHERE id = p_job_id
    AND status = 'running';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: completion update affected 0 rows for job %', p_job_id;
  END IF;

  RETURN QUERY SELECT v_canonical_id, v_summary_id;
END;
$finalizer_complete$;

