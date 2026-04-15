-- Phase 2C: Lease Service
-- Provides claim, heartbeat, expire, reclaim, release for job queue

-- Lease tracking table
CREATE TABLE IF NOT EXISTS job_leases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES evaluation_jobs(id),
  worker_id text NOT NULL,
  lease_token uuid NOT NULL DEFAULT gen_random_uuid(),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  released_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','released','reclaimed')),
  CONSTRAINT unique_active_lease UNIQUE (job_id) -- only one active lease per job enforced at app level
);

CREATE INDEX IF NOT EXISTS idx_job_leases_job_id ON job_leases(job_id);
CREATE INDEX IF NOT EXISTS idx_job_leases_expires ON job_leases(expires_at) WHERE status = 'active';

-- claim_lease: atomically claims a queued job
CREATE OR REPLACE FUNCTION claim_lease(
  p_job_id uuid,
  p_worker_id text,
  p_ttl_seconds int DEFAULT 300
) RETURNS jsonb AS $$
DECLARE
  v_lease_token uuid;
  v_job_status text;
  v_existing_lease record;
BEGIN
  -- Lock the job row
  SELECT status INTO v_job_status FROM evaluation_jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_found');
  END IF;
  IF v_job_status != 'queued' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'job_not_queued', 'current_status', v_job_status);
  END IF;

  -- Check no active lease exists
  SELECT * INTO v_existing_lease FROM job_leases
    WHERE job_id = p_job_id AND status = 'active' AND expires_at > now();
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_leased', 'worker', v_existing_lease.worker_id);
  END IF;

  -- Expire any stale leases
  UPDATE job_leases SET status = 'expired' WHERE job_id = p_job_id AND status = 'active' AND expires_at <= now();

  v_lease_token := gen_random_uuid();
  INSERT INTO job_leases (job_id, worker_id, lease_token, expires_at)
    VALUES (p_job_id, p_worker_id, v_lease_token, now() + (p_ttl_seconds || ' seconds')::interval);

  -- Transition job to processing
  PERFORM atomic_transition(
    p_job_id := p_job_id,
    p_from_state := 'queued',
    p_to_state := 'processing',
    p_lease_token := v_lease_token,
    p_actor := p_worker_id,
    p_reason := 'lease_claimed'
  );

  RETURN jsonb_build_object('ok', true, 'lease_token', v_lease_token, 'expires_at', now() + (p_ttl_seconds || ' seconds')::interval);
END;
$$ LANGUAGE plpgsql;

-- heartbeat_lease: extends lease TTL
CREATE OR REPLACE FUNCTION heartbeat_lease(
  p_job_id uuid,
  p_lease_token uuid,
  p_ttl_seconds int DEFAULT 300
) RETURNS jsonb AS $$
DECLARE
  v_lease record;
BEGIN
  SELECT * INTO v_lease FROM job_leases
    WHERE job_id = p_job_id AND lease_token = p_lease_token AND status = 'active'
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lease_not_found_or_expired');
  END IF;
  IF v_lease.expires_at <= now() THEN
    UPDATE job_leases SET status = 'expired' WHERE id = v_lease.id;
    RETURN jsonb_build_object('ok', false, 'error', 'lease_expired');
  END IF;
  UPDATE job_leases SET
    last_heartbeat = now(),
    expires_at = now() + (p_ttl_seconds || ' seconds')::interval
  WHERE id = v_lease.id;
  RETURN jsonb_build_object('ok', true, 'expires_at', now() + (p_ttl_seconds || ' seconds')::interval);
END;
$$ LANGUAGE plpgsql;

-- release_lease: worker voluntarily releases
CREATE OR REPLACE FUNCTION release_lease(
  p_job_id uuid,
  p_lease_token uuid
) RETURNS jsonb AS $$
DECLARE
  v_lease record;
BEGIN
  SELECT * INTO v_lease FROM job_leases
    WHERE job_id = p_job_id AND lease_token = p_lease_token AND status = 'active'
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'lease_not_found');
  END IF;
  UPDATE job_leases SET status = 'released', released_at = now() WHERE id = v_lease.id;
  RETURN jsonb_build_object('ok', true);
END;
$$ LANGUAGE plpgsql;

-- expire_stale_leases: cron-callable to expire and requeue
CREATE OR REPLACE FUNCTION expire_stale_leases() RETURNS jsonb AS $$
DECLARE
  v_expired int := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT jl.id as lease_id, jl.job_id, jl.worker_id
    FROM job_leases jl
    JOIN evaluation_jobs ej ON ej.id = jl.job_id
    WHERE jl.status = 'active' AND jl.expires_at <= now()
    FOR UPDATE OF jl
  LOOP
    UPDATE job_leases SET status = 'expired' WHERE id = v_rec.lease_id;
    -- Requeue the job if still processing
    UPDATE evaluation_jobs SET status = 'queued', updated_at = now()
      WHERE id = v_rec.job_id AND status = 'processing';
    INSERT INTO transition_log (job_id, from_state, to_state, actor, reason)
      VALUES (v_rec.job_id, 'processing', 'queued', 'system:lease_expiry', 'lease_expired_requeue');
    v_expired := v_expired + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'expired_count', v_expired);
END;
$$ LANGUAGE plpgsql;
