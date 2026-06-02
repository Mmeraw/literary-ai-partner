-- Migration: Enable RLS on artifact_dependencies
-- Fixes: Supabase security alert "rls_disabled_in_public" for artifact_dependencies
-- The table was created in 20260522030000_artifact_staleness_propagation.sql without RLS.
-- This is an internal system table (dependency graph for staleness propagation)
-- and should follow the service-role-only posture used by other internal tables.

ALTER TABLE public.artifact_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS artifact_dependencies_service_role_all ON public.artifact_dependencies;
CREATE POLICY artifact_dependencies_service_role_all
  ON public.artifact_dependencies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
