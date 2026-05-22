-- =============================================================================
-- Round 6 Hardening: Scope role-specific policies TO authenticated
-- =============================================================================
--
-- WHAT THIS FIXES:
--
-- The remaining "multiple_permissive_policies" WARNs fire because the named
-- role-specific policies (Author/Admin/Industry/Enterprise) are scoped to
-- {public}, which means both anon AND authenticated roles each trigger the
-- overlap check (Supabase reports once per role per overlap).
--
-- All these policies check current_setting('request.jwt.claims')::jsonb->>'role'
-- which requires a valid JWT — anon requests have no JWT, so they can never
-- satisfy these conditions anyway. Scoping them TO authenticated:
--   1. Eliminates the multiple_permissive_policies WARN (anon no longer sees them)
--   2. Marginally faster — anon requests skip these policies entirely
--   3. Semantically correct — these are authenticated-only operations
--
-- Tables fixed: access_log, analytics, evaluation_artifacts, evaluations,
--               manuscript_chunks, manuscripts
--
-- NOT changed: policies that explicitly allow anon (share links, public reads)
--              service_role policies — already correctly scoped
-- =============================================================================

-- -----------------------------------------------------------------------------
-- access_log
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view all access logs" ON public.access_log;
CREATE POLICY "Admin: view all access logs"
  ON public.access_log FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
  );

DROP POLICY IF EXISTS "Author: view own access logs" ON public.access_log;
CREATE POLICY "Author: view own access logs"
  ON public.access_log FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND (SELECT auth.uid()) = user_id
  );

-- -----------------------------------------------------------------------------
-- analytics
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/Enterprise: view aggregate analytics" ON public.analytics;
CREATE POLICY "Admin/Enterprise: view aggregate analytics"
  ON public.analytics FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role')
      = ANY (ARRAY['admin_reviewer', 'enterprise_manager'])
  );

DROP POLICY IF EXISTS "Author: view own analytics" ON public.analytics;
CREATE POLICY "Author: view own analytics"
  ON public.analytics FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND user_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- evaluation_artifacts
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authors view own artifacts" ON public.evaluation_artifacts;
CREATE POLICY "Authors view own artifacts"
  ON public.evaluation_artifacts FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND EXISTS (
      SELECT 1
      FROM evaluation_jobs j
      JOIN manuscripts m ON m.id = j.manuscript_id
      WHERE j.id = evaluation_artifacts.job_id
        AND m.created_by = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- evaluations
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view evaluations for Storygate manuscripts" ON public.evaluations;
CREATE POLICY "Admin: view evaluations for Storygate manuscripts"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
    AND EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = evaluations.manuscript_id
        AND m.storygate_linked = true
    )
  );

DROP POLICY IF EXISTS "Author: view evaluations for own manuscripts" ON public.evaluations;
CREATE POLICY "Author: view evaluations for own manuscripts"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = evaluations.manuscript_id
        AND m.created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Industry: view curated evaluation summaries" ON public.evaluations;
CREATE POLICY "Industry: view curated evaluation summaries"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'industry_agent'
    AND EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = evaluations.manuscript_id
        AND m.storygate_linked = true
        AND m.allow_industry_discovery = true
        AND m.is_final = true
    )
  );

-- -----------------------------------------------------------------------------
-- manuscript_chunks
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view Storygate manuscript chunks" ON public.manuscript_chunks;
CREATE POLICY "Admin: view Storygate manuscript chunks"
  ON public.manuscript_chunks FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
    AND EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = manuscript_chunks.manuscript_id
        AND m.storygate_linked = true
    )
  );

-- -----------------------------------------------------------------------------
-- manuscripts
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view Storygate manuscripts" ON public.manuscripts;
CREATE POLICY "Admin: view Storygate manuscripts"
  ON public.manuscripts FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
    AND storygate_linked = true
  );

DROP POLICY IF EXISTS "Author: insert own manuscripts" ON public.manuscripts;
CREATE POLICY "Author: insert own manuscripts"
  ON public.manuscripts FOR INSERT
  TO authenticated
  WITH CHECK (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Author: update own manuscripts" ON public.manuscripts;
CREATE POLICY "Author: update own manuscripts"
  ON public.manuscripts FOR UPDATE
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND created_by = (SELECT auth.uid())
  )
  WITH CHECK (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Author: view own manuscripts" ON public.manuscripts;
CREATE POLICY "Author: view own manuscripts"
  ON public.manuscripts FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Industry: view opted-in manuscripts" ON public.manuscripts;
CREATE POLICY "Industry: view opted-in manuscripts"
  ON public.manuscripts FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'industry_agent'
    AND storygate_linked = true
    AND allow_industry_discovery = true
    AND is_final = true
  );
