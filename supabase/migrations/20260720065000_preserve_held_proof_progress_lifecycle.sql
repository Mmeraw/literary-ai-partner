-- Preserve the canonical lifecycle vocabulary inside progress JSON while a
-- proof-only evaluation is held outside the worker claim path.
--
-- evaluation_jobs.phase_status is the queue authority and may be
-- awaiting_approval. progress.phase_status is consumed by lifecycle validators
-- that accept only queued/running/complete/failed. The durable proof marker is
-- the authority that explains why a queued lifecycle is temporarily
-- undispatchable; copying awaiting_approval into progress creates split-brain
-- state and defeats the application-side hold contract.

CREATE OR REPLACE FUNCTION public.sync_evaluation_job_progress_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_progress jsonb := CASE
    WHEN jsonb_typeof(NEW.progress) = 'object' THEN NEW.progress
    ELSE '{}'::jsonb
  END;
  v_old_progress jsonb := CASE
    WHEN TG_OP = 'UPDATE' AND jsonb_typeof(OLD.progress) = 'object' THEN OLD.progress
    ELSE '{}'::jsonb
  END;
  v_requested_completed integer := COALESCE(NEW.completed_units, 0);
  v_progress_completed integer := CASE
    WHEN jsonb_typeof(v_progress -> 'completed_units') = 'number'
      THEN (v_progress ->> 'completed_units')::integer
    ELSE 0
  END;
  v_requested_high_water integer := CASE
    WHEN jsonb_typeof(v_progress -> 'progress_high_water') = 'number'
      THEN (v_progress ->> 'progress_high_water')::integer
    ELSE 0
  END;
  v_old_completed integer := CASE
    WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.completed_units, 0)
    ELSE 0
  END;
  v_old_progress_completed integer := CASE
    WHEN TG_OP = 'UPDATE'
      AND jsonb_typeof(v_old_progress -> 'completed_units') = 'number'
      THEN (v_old_progress ->> 'completed_units')::integer
    ELSE 0
  END;
  v_old_high_water integer := CASE
    WHEN TG_OP = 'UPDATE'
      AND jsonb_typeof(v_old_progress -> 'progress_high_water') = 'number'
      THEN (v_old_progress ->> 'progress_high_water')::integer
    ELSE 0
  END;
  v_high_water integer;
  v_phase text;
  v_progress_phase_status text;
  v_patch jsonb;
BEGIN
  v_high_water := GREATEST(
    0,
    v_requested_completed,
    v_progress_completed,
    v_requested_high_water,
    v_old_completed,
    v_old_progress_completed,
    v_old_high_water
  );

  IF NEW.total_units IS NOT NULL AND NEW.total_units > 0 THEN
    v_high_water := LEAST(v_high_water, NEW.total_units);
  END IF;

  v_phase := CASE
    WHEN NEW.phase = 'phase_1' THEN 'phase_1a'
    ELSE NEW.phase
  END;

  -- Only the proof-only undispatched hold uses a queue authority state that is
  -- intentionally outside the canonical progress lifecycle vocabulary.
  -- Review Gate and every ordinary evaluation continue to mirror the column.
  v_progress_phase_status := CASE
    WHEN NEW.phase_status = 'awaiting_approval'
      AND v_progress @> '{"held_recovery_proof_hold": true}'::jsonb
      THEN 'queued'
    ELSE NEW.phase_status
  END;

  NEW.phase := v_phase;
  NEW.completed_units := v_high_water;

  v_patch := jsonb_build_object(
    'phase', v_phase,
    'phase_status', v_progress_phase_status,
    'completed_units', v_high_water,
    'progress_high_water', v_high_water
  );

  IF NEW.total_units IS NOT NULL THEN
    v_patch := v_patch || jsonb_build_object('total_units', NEW.total_units);
  END IF;

  NEW.progress := v_progress || v_patch;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_evaluation_job_progress_authority() FROM PUBLIC;

-- Repair any proof job created after the application fix but before this
-- trigger correction. The trigger above preserves queued during this update.
UPDATE public.evaluation_jobs
SET progress = jsonb_set(progress, '{phase_status}', '"queued"'::jsonb, true)
WHERE status = 'queued'
  AND phase_status = 'awaiting_approval'
  AND progress @> '{"held_recovery_proof_hold": true}'::jsonb
  AND progress ->> 'phase_status' IS DISTINCT FROM 'queued';

COMMENT ON FUNCTION public.sync_evaluation_job_progress_authority() IS
  'Synchronizes evaluation lifecycle authority while preserving canonical queued progress for proof-only undispatched Held Recovery holds.';
