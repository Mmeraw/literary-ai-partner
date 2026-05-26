-- Migration: claim_job_atomic_worker_id_validation
-- Purpose:
--   Add worker_id deny-list to claim_job_atomic to reject non-production
--   synthetic probe IDs (e.g. "signature-test", "worker-1", "worker-2", etc.)
--   that should NEVER claim real production jobs.
--
--   These patterns were used in scripts/jobs-supabase-contract-smoke.mjs to
--   probe the RPC signature and leaked into production when queued jobs were
--   present at CI run time, orphaning jobs at phase_1a.
--
--   RULE: worker_id must match production pattern: "production:<ip>:<traceId>"
--   Any worker_id that does NOT start with "production:" is rejected.
--
-- Also adds claim event to progress JSONB for audit trail.

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
      v_claim_event jsonb;
    BEGIN
      -- ── Worker ID validation ────────────────────────────────────────────────
      -- Reject blank, null, or non-production worker IDs.
      -- Production workers always identify as "production:<ip>:<traceId>".
      -- Synthetic probe IDs ("signature-test", "worker-1", etc.) must never
      -- claim real jobs.
      IF p_worker_id IS NULL OR btrim(p_worker_id) = '' THEN
        RAISE EXCEPTION 'claim_job_atomic: p_worker_id cannot be null or blank';
      END IF;

      IF p_worker_id NOT LIKE 'production:%' THEN
        RAISE EXCEPTION 'claim_job_atomic: worker_id "%" rejected — must match production:<ip>:<traceId> pattern. Synthetic probe IDs must not claim production jobs.',
          p_worker_id;
      END IF;
      -- ── End worker ID validation ────────────────────────────────────────────

      -- Claim event for progress JSONB audit trail
      v_claim_event := jsonb_build_object(
        '_type',     'claim_event',
        'worker_id', p_worker_id,
        'claimed_at', p_now,
        'lease_until', v_lease_until
      );

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
        status       = 'running',
        phase_status = 'running',
        claimed_by   = p_worker_id,
        worker_id    = p_worker_id,
        lease_token  = v_lease_token,
        lease_until  = v_lease_until,
        heartbeat_at = p_now,
        started_at   = COALESCE(ej.started_at, p_now),
        updated_at   = p_now,
        progress     = COALESCE(ej.progress, '{}'::jsonb) || jsonb_build_object(
                         'claim_events',
                         COALESCE((ej.progress -> 'claim_events'), '[]'::jsonb) || jsonb_build_array(v_claim_event)
                       )
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

COMMENT ON FUNCTION public.claim_job_atomic(text, timestamptz, integer) IS
  'Atomic job claim RPC. Enforces production:<ip>:<traceId> worker_id pattern — rejects synthetic probe IDs. Logs claim event to progress JSONB. TTL clamped 30–900s.';
