DO $$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NULL THEN
    RAISE NOTICE 'evaluation_jobs not present; skipping invariant check';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM evaluation_jobs
    WHERE status = 'running'
      AND (worker_id IS NULL OR lease_token IS NULL OR lease_until IS NULL)
  ) THEN
    RAISE EXCEPTION 'Running job invariant violated: missing claim fields';
  END IF;
END $$;
