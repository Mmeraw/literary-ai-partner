-- =============================================================================
-- Migration: Hybrid RLS hardening — evaluation_jobs
-- Date: 2026-05-23
-- Purpose: Replace prior owner-only policy with hybrid (user_id OR project
--          ownership OR manuscript ownership). Safe on environments where
--          related tables may not yet exist.
-- =============================================================================

DO $outer$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NULL THEN
    RAISE NOTICE 'Skipping RLS hardening: public.evaluation_jobs not present';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.evaluation_jobs ENABLE ROW LEVEL SECURITY';

  -- Drop any prior policies for clean recreate (idempotent)
  EXECUTE 'DROP POLICY IF EXISTS "eval_jobs: owner read" ON public.evaluation_jobs';
  EXECUTE 'DROP POLICY IF EXISTS "eval_jobs: owner write" ON public.evaluation_jobs';
  EXECUTE 'DROP POLICY IF EXISTS "Service role: full access" ON public.evaluation_jobs';

  -- Service role retains full access
  EXECUTE $p$
    CREATE POLICY "Service role: full access"
    ON public.evaluation_jobs
    FOR ALL TO service_role
    USING (true) WITH CHECK (true)
  $p$;

  -- Hybrid owner read: direct user_id OR via project OR via manuscript
  EXECUTE $p$
    CREATE POLICY "eval_jobs: owner read"
    ON public.evaluation_jobs
    FOR SELECT TO authenticated
    USING (
      user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.evaluation_projects ep
        WHERE ep.id = evaluation_jobs.project_id
          AND ep.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.manuscripts m
        WHERE m.id = evaluation_jobs.manuscript_id
          AND m.user_id = (SELECT auth.uid())
      )
    )
  $p$;

  -- Hybrid owner write: same predicate on USING + WITH CHECK
  EXECUTE $p$
    CREATE POLICY "eval_jobs: owner write"
    ON public.evaluation_jobs
    FOR ALL TO authenticated
    USING (
      user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.evaluation_projects ep
        WHERE ep.id = evaluation_jobs.project_id
          AND ep.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.manuscripts m
        WHERE m.id = evaluation_jobs.manuscript_id
          AND m.user_id = (SELECT auth.uid())
      )
    )
    WITH CHECK (
      user_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.evaluation_projects ep
        WHERE ep.id = evaluation_jobs.project_id
          AND ep.user_id = (SELECT auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.manuscripts m
        WHERE m.id = evaluation_jobs.manuscript_id
          AND m.user_id = (SELECT auth.uid())
      )
    )
  $p$;
END $outer$;
