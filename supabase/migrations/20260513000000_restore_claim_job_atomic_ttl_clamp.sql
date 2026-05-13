-- Restore canonical TTL clamping contract in claim_job_atomic.
-- Required bounds: 30s <= lease ttl <= 900s.

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
      lease_token uuid,
      lease_until timestamptz,
      heartbeat_at timestamptz,
      started_at timestamptz
    )
    LANGUAGE plpgsql
    AS $claim_function$
    DECLARE
      v_lease_token uuid := gen_random_uuid();
      v_clamped_ttl integer := GREATEST(30, LEAST(COALESCE(p_lease_seconds, 300), 900));
      v_lease_until timestamptz := p_now + make_interval(secs => v_clamped_ttl);
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
        status = 'running',
        phase_status = 'running',
        claimed_by = p_worker_id,
        worker_id = p_worker_id,
        lease_token = v_lease_token,
        lease_until = v_lease_until,
        heartbeat_at = p_now,
        started_at = COALESCE(ej.started_at, p_now),
        updated_at = p_now
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
