-- Migration: Enable RLS on tables missing it
-- Fixes: Supabase security alert "rls_disabled_in_public"
-- Tables that were created without ENABLE ROW LEVEL SECURITY:
--   - artifact_dependencies (20260522030000_artifact_staleness_propagation.sql)
--   - evaluation_events, evaluation_projects, evaluation_stage_runs (20260117060042_remote_schema.sql)
--   - pipeline_logs (20260519000000_pipeline_logs.sql)
--
-- NOTE: Production already has RLS enabled on evaluation_events, evaluation_projects,
--       evaluation_stage_runs, and pipeline_logs via manual SQL Editor apply (2026-04-02).
--       This migration adds the tracked statements so fresh environments and CI match.

-- 1. artifact_dependencies (internal staleness propagation graph)
ALTER TABLE public.artifact_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artifact_dependencies_service_role_all ON public.artifact_dependencies;
CREATE POLICY artifact_dependencies_service_role_all
  ON public.artifact_dependencies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. evaluation_events (internal pipeline event log)
DO $$ BEGIN
  IF to_regclass('public.evaluation_events') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.evaluation_events ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS evaluation_events_service_role_all ON public.evaluation_events';
    EXECUTE 'CREATE POLICY evaluation_events_service_role_all ON public.evaluation_events FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 3. evaluation_projects (internal project container)
DO $$ BEGIN
  IF to_regclass('public.evaluation_projects') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.evaluation_projects ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS evaluation_projects_service_role_all ON public.evaluation_projects';
    EXECUTE 'CREATE POLICY evaluation_projects_service_role_all ON public.evaluation_projects FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 4. evaluation_stage_runs (internal stage execution tracking)
DO $$ BEGIN
  IF to_regclass('public.evaluation_stage_runs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.evaluation_stage_runs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS evaluation_stage_runs_service_role_all ON public.evaluation_stage_runs';
    EXECUTE 'CREATE POLICY evaluation_stage_runs_service_role_all ON public.evaluation_stage_runs FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- 5. pipeline_logs (internal pipeline debug logs)
DO $$ BEGIN
  IF to_regclass('public.pipeline_logs') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.pipeline_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS pipeline_logs_service_role_all ON public.pipeline_logs';
    EXECUTE 'CREATE POLICY pipeline_logs_service_role_all ON public.pipeline_logs FOR ALL TO service_role USING (true) WITH CHECK (true)';
  END IF;
END $$;
