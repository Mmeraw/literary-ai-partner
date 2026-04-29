-- RCA-JOB-LIFECYCLE-001
-- Fix claim_job_atomic so queued -> running writes ALL required claim/lease
-- fields in the SAME UPDATE that changes status to 'running'.
--
-- Supabase remote migration push prepares each migration file as a single
-- statement. Use one DO block with dynamic SQL so the required DROP + CREATE
-- sequence remains replay-safe and avoids SQLSTATE 42601.

DO $migration$
BEGIN
  EXECUTE 'DROP FUNCTION IF EXISTS public.claim_job_atomic(text, timestamptz, integer)';

  EXECUTE $function$
    CREATE FUNCTION public.claim_job_atomic(
      p_worker_id text,
      p_now timestamptz DEFAULT now(),
      p_lease_seconds integer DEFAULT 300
    )
    RETURNS TABLE (
      id uuid,
      manuscript_id bigint,
      job_type text,
      policy_family text,
      voice_preservation_level text,
      english_variant text,
      work_type text,
      phase text,
      status text,
      claimed_by text,
      worker_id text,
      lease_token text,
      lease_until timestamptz,
      heartbeat_at timestamptz,
      started_at timestamptz
    )
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $claim_function$
    DECLARE
      v_lease_token text := gen_random_uuid()::text;
      v_lease_until timestamptz := p_now + make_interval(secs => p_lease_seconds);
    BEGIN
      RETURN QUERY
      WITH candidate AS (
        SELECT ej.id
        FROM public.evaluation_jobs ej
        WHERE ej.status = 'queued'
          AND (ej.next_attempt_at IS NULL OR ej.next_attempt_at <= p_now)
        ORDER BY ej.created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public.evaluation_jobs ej
      SET
        status        = 'running',
        phase_status  = 'running',
        claimed_by    = p_worker_id,
        worker_id     = p_worker_id,
        lease_token   = v_lease_token,
        lease_until   = v_lease_until,
        heartbeat_at  = p_now,
        started_at    = COALESCE(ej.started_at, p_now),
        updated_at    = p_now
      FROM candidate
      WHERE ej.id = candidate.id
      RETURNING
        ej.id,
        ej.manuscript_id,
        ej.job_type,
        ej.policy_family,
        ej.voice_preservation_level,
        ej.english_variant,
        ej.work_type,
        ej.phase,
        ej.status,
        ej.claimed_by,
        ej.worker_id,
        ej.lease_token,
        ej.lease_until,
        ej.heartbeat_at,
        ej.started_at;
    END;
    $claim_function$
  $function$;
END;
$migration$;
