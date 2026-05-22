-- =============================================================================
-- Round 4 Hardening: auth_rls_initplan fixes + missing FK index
-- =============================================================================
--
-- WHAT THIS FIXES:
--
-- 1. 14 RLS policies where current_setting('request.jwt.claims'...) is called
--    inline (not in a subquery), causing Postgres to re-evaluate it for every
--    row scanned. The fix: wrap in (SELECT current_setting(...)) so the planner
--    hoists it as an InitPlan — evaluated once per statement, not per row.
--
--    Tables: access_log, analytics, evaluation_artifacts, evaluations,
--            manuscript_chunks, manuscripts
--
-- 2. Missing index on revision_events.manuscript_version_id (FK without index).
--    Causes sequential scans when joining/filtering by version.
--
-- PATTERN: For every affected policy we DROP and recreate with:
--   (SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role'
-- instead of:
--   current_setting('request.jwt.claims', true)::jsonb ->> 'role'
--
-- NOTE: auth.uid() calls in these policies already use (SELECT auth.uid() AS uid)
--       subquery form — those are correct and left as-is.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: access_log
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin: view all access logs" ON public.access_log;
CREATE POLICY "Admin: view all access logs"
  ON public.access_log FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
  );

DROP POLICY IF EXISTS "Author: view own access logs" ON public.access_log;
CREATE POLICY "Author: view own access logs"
  ON public.access_log FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND (SELECT auth.uid()) = user_id
  );

-- -----------------------------------------------------------------------------
-- TABLE: analytics
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin/Enterprise: view aggregate analytics" ON public.analytics;
CREATE POLICY "Admin/Enterprise: view aggregate analytics"
  ON public.analytics FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role')
      = ANY (ARRAY['admin_reviewer', 'enterprise_manager'])
  );

DROP POLICY IF EXISTS "Author: view own analytics" ON public.analytics;
CREATE POLICY "Author: view own analytics"
  ON public.analytics FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND user_id = (SELECT auth.uid())
  );

-- -----------------------------------------------------------------------------
-- TABLE: evaluation_artifacts
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Authors view own artifacts" ON public.evaluation_artifacts;
CREATE POLICY "Authors view own artifacts"
  ON public.evaluation_artifacts FOR SELECT
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
-- TABLE: evaluations
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin: view evaluations for Storygate manuscripts" ON public.evaluations;
CREATE POLICY "Admin: view evaluations for Storygate manuscripts"
  ON public.evaluations FOR SELECT
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
-- TABLE: manuscript_chunks
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin: view Storygate manuscript chunks" ON public.manuscript_chunks;
CREATE POLICY "Admin: view Storygate manuscript chunks"
  ON public.manuscript_chunks FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
    AND EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = manuscript_chunks.manuscript_id
        AND m.storygate_linked = true
    )
  );

-- -----------------------------------------------------------------------------
-- TABLE: manuscripts
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Admin: view Storygate manuscripts" ON public.manuscripts;
CREATE POLICY "Admin: view Storygate manuscripts"
  ON public.manuscripts FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
    AND storygate_linked = true
  );

DROP POLICY IF EXISTS "Author: insert own manuscripts" ON public.manuscripts;
CREATE POLICY "Author: insert own manuscripts"
  ON public.manuscripts FOR INSERT
  WITH CHECK (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Author: update own manuscripts" ON public.manuscripts;
CREATE POLICY "Author: update own manuscripts"
  ON public.manuscripts FOR UPDATE
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
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
    AND created_by = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "Industry: view opted-in manuscripts" ON public.manuscripts;
CREATE POLICY "Industry: view opted-in manuscripts"
  ON public.manuscripts FOR SELECT
  USING (
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'industry_agent'
    AND storygate_linked = true
    AND allow_industry_discovery = true
    AND is_final = true
  );

-- -----------------------------------------------------------------------------
-- SECTION 2: Missing FK index — revision_events.manuscript_version_id
-- -----------------------------------------------------------------------------

-- NOTE: CONCURRENTLY cannot run inside a migration transaction.
-- Using standard CREATE INDEX — locks are brief on a small table.
CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_version_id
  ON public.revision_events (manuscript_version_id);
