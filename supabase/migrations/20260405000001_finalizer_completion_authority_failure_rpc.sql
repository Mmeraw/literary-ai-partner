-- Migration: Finalizer completion authority failure RPC
-- Purpose: Install failure transition authority function in a standalone statement.
-- Scope: #89 write-authority only

CREATE OR REPLACE FUNCTION public.finalizer_mark_job_failed(
	p_job_id uuid,
	p_worker_id text,
	p_failure_code text,
	p_last_error text
)
RETURNS void
LANGUAGE plpgsql
AS $finalizer_failed$
DECLARE
	v_job public.evaluation_jobs%ROWTYPE;
	v_phase text;
	v_claim_lease_id text;
	v_now timestamptz := now();
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
		RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: cannot fail terminal job % (%)', p_job_id, v_job.status;
	END IF;

	IF v_job.status <> 'running' THEN
		RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % must be running to fail (got %)', p_job_id, v_job.status;
	END IF;

	v_phase := COALESCE(v_job.progress->>'phase', v_job.phase, '');
	IF v_phase <> 'finalizer' THEN
		RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % phase must be finalizer to fail (got %)', p_job_id, v_phase;
	END IF;

	v_claim_lease_id := COALESCE(v_job.progress->>'lease_id', '');
	IF v_claim_lease_id = '' OR v_claim_lease_id <> p_worker_id THEN
		RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: job % failure claim mismatch (expected %, got %)', p_job_id, p_worker_id, v_claim_lease_id;
	END IF;

	v_progress := COALESCE(v_job.progress, '{}'::jsonb);
	v_progress := jsonb_set(v_progress, '{failure_code}', to_jsonb(p_failure_code), true);
	v_progress := jsonb_set(v_progress, '{terminal_at}', to_jsonb(v_now::text), true);
	v_progress := jsonb_set(v_progress, '{phase_status}', '"failed"'::jsonb, true);

	UPDATE public.evaluation_jobs
	SET
		status = 'failed',
		last_error = p_last_error,
		progress = v_progress,
		updated_at = v_now
	WHERE id = p_job_id
		AND status = 'running';

	IF NOT FOUND THEN
		RAISE EXCEPTION 'FINALIZER_AUTHORITY_VIOLATION: failure update affected 0 rows for job %', p_job_id;
	END IF;
END;
$finalizer_failed$;
