-- Synchronize evaluation_jobs column authority with its progress JSONB shadow.
--
-- Production incident addressed:
--   Durable phase artifacts could exist while progress.phase and progress counters
--   still described an earlier phase. The processor also computes a monotonic
--   progress_high_water but some writers can persist a lower top-level
--   completed_units value on retry/resume.
--
-- Contract:
--   * evaluation_jobs.phase / phase_status remain authoritative.
--   * progress.phase / phase_status mirror those columns on every relevant write.
--   * completed_units and progress.completed_units share one monotonic high-water.
--   * review_gate / awaiting_approval remain truthful hard-stop states; this trigger
--     does not infer or skip a gate from artifact presence alone.

CREATE OR REPLACE FUNCTION public.sync_evaluation_job_progress_authority()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_progress jsonb := COALESCE(NEW.progress, '{}'::jsonb);
  v_old_progress jsonb := CASE
    WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.progress, '{}'::jsonb)
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
  v_old_high_water integer := CASE
    WHEN TG_OP = 'UPDATE'
      AND jsonb_typeof(v_old_progress -> 'progress_high_water') = 'number'
      THEN (v_old_progress ->> 'progress_high_water')::integer
    ELSE 0
  END;
  v_high_water integer;
  v_phase text;
  v_patch jsonb;
BEGIN
  v_high_water := GREATEST(
    0,
    v_requested_completed,
    v_progress_completed,
    v_requested_high_water,
    v_old_completed,
    v_old_high_water
  );

  -- Keep unit counters valid when a total is available. Evaluation jobs currently
  -- use 100 units, but this remains generic for tests and future job types.
  IF NEW.total_units IS NOT NULL AND NEW.total_units > 0 THEN
    v_high_water := LEAST(v_high_water, NEW.total_units);
  END IF;

  -- Normalize the one legacy DB phase alias while preserving every canonical
  -- phase, including review_gate. The trigger mirrors authority; it never invents
  -- a downstream phase from artifact presence.
  v_phase := CASE
    WHEN NEW.phase = 'phase_1' THEN 'phase_1a'
    ELSE NEW.phase
  END;

  NEW.phase := v_phase;
  NEW.completed_units := v_high_water;

  v_patch := jsonb_build_object(
    'phase', v_phase,
    'phase_status', NEW.phase_status,
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

DROP TRIGGER IF EXISTS evaluation_jobs_sync_progress_authority
  ON public.evaluation_jobs;

CREATE TRIGGER evaluation_jobs_sync_progress_authority
BEFORE INSERT OR UPDATE OF
  phase,
  phase_status,
  completed_units,
  total_units,
  progress
ON public.evaluation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_evaluation_job_progress_authority();

REVOKE ALL ON FUNCTION public.sync_evaluation_job_progress_authority() FROM PUBLIC;

COMMENT ON FUNCTION public.sync_evaluation_job_progress_authority() IS
  'Keeps evaluation_jobs phase/status and monotonic completed-unit authority synchronized with progress JSONB without bypassing Review Gate states.';
