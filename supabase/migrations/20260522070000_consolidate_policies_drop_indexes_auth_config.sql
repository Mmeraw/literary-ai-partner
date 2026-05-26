-- =============================================================================
-- Round 7 Hardening: Consolidate multi-permissive policies, drop unused indexes
-- =============================================================================
--
-- SECTION 1: Consolidate multiple SELECT policies per table into one
--
-- Each of the 5 remaining tables has 2-3 permissive SELECT policies for
-- `authenticated` (Admin/Author/Industry/Enterprise). Postgres evaluates ALL
-- matching permissive policies per row — even when the first one would grant
-- access. The fix: merge them into a single policy with OR branches.
-- Result: one policy evaluated once per row, zero multiple_permissive_policies.
--
-- SECTION 2: Drop 46 unused indexes (idx_scan = 0 confirmed via pg_stat_user_indexes)
--
-- These indexes have never been used in query plans. They cost write overhead
-- on every INSERT/UPDATE with zero read benefit. Dropped. Can be re-added if
-- query plans degrade under scale.
--
-- NOTE: Auth DB connection strategy (absolute → percentage) is a Supabase
-- Auth server config — cannot be changed via SQL migration. Must be done
-- via Supabase dashboard: Auth > Advanced > Max DB connections > switch to %.
-- =============================================================================

-- =============================================================================
-- SECTION 1: Consolidate multiple permissive SELECT policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- access_log — merge Admin + Author into one policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view all access logs"  ON public.access_log;
DROP POLICY IF EXISTS "Author: view own access logs" ON public.access_log;

DROP POLICY IF EXISTS "Role-based SELECT access" ON public.access_log;
CREATE POLICY "Role-based SELECT access"
  ON public.access_log FOR SELECT
  TO authenticated
  USING (
    -- Admin: sees all
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
    OR
    -- Author: sees own
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
      AND (SELECT auth.uid()) = user_id
    )
  );

-- -----------------------------------------------------------------------------
-- analytics — merge Admin/Enterprise + Author into one policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/Enterprise: view aggregate analytics" ON public.analytics;
DROP POLICY IF EXISTS "Author: view own analytics"                  ON public.analytics;

DROP POLICY IF EXISTS "Role-based SELECT access" ON public.analytics;
CREATE POLICY "Role-based SELECT access"
  ON public.analytics FOR SELECT
  TO authenticated
  USING (
    -- Admin + Enterprise: aggregate view
    ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role')
      = ANY (ARRAY['admin_reviewer', 'enterprise_manager'])
    OR
    -- Author: own analytics only
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
      AND user_id = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- evaluations — merge Admin + Author + Industry into one policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view evaluations for Storygate manuscripts" ON public.evaluations;
DROP POLICY IF EXISTS "Author: view evaluations for own manuscripts"       ON public.evaluations;
DROP POLICY IF EXISTS "Industry: view curated evaluation summaries"        ON public.evaluations;

DROP POLICY IF EXISTS "Role-based SELECT access" ON public.evaluations;
CREATE POLICY "Role-based SELECT access"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    -- Admin: Storygate-linked manuscripts
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
      AND EXISTS (
        SELECT 1 FROM manuscripts m
        WHERE m.id = evaluations.manuscript_id AND m.storygate_linked = true
      )
    )
    OR
    -- Author: own manuscripts
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
      AND EXISTS (
        SELECT 1 FROM manuscripts m
        WHERE m.id = evaluations.manuscript_id AND m.created_by = (SELECT auth.uid())
      )
    )
    OR
    -- Industry: public opted-in manuscripts
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'industry_agent'
      AND EXISTS (
        SELECT 1 FROM manuscripts m
        WHERE m.id = evaluations.manuscript_id
          AND m.storygate_linked = true
          AND m.allow_industry_discovery = true
          AND m.is_final = true
      )
    )
  );

-- -----------------------------------------------------------------------------
-- manuscript_chunks — merge Admin + Author into one policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view Storygate manuscript chunks" ON public.manuscript_chunks;
DROP POLICY IF EXISTS "Author: view own manuscript chunks"      ON public.manuscript_chunks;

DROP POLICY IF EXISTS "Role-based SELECT access" ON public.manuscript_chunks;
CREATE POLICY "Role-based SELECT access"
  ON public.manuscript_chunks FOR SELECT
  TO authenticated
  USING (
    -- Admin: Storygate-linked
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
      AND EXISTS (
        SELECT 1 FROM manuscripts m
        WHERE m.id = manuscript_chunks.manuscript_id AND m.storygate_linked = true
      )
    )
    OR
    -- Author: own chunks
    EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = manuscript_chunks.manuscript_id
        AND m.created_by = (SELECT auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- manuscripts — merge Admin + Author + Industry into one policy
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin: view Storygate manuscripts"  ON public.manuscripts;
DROP POLICY IF EXISTS "Author: view own manuscripts"       ON public.manuscripts;
DROP POLICY IF EXISTS "Industry: view opted-in manuscripts" ON public.manuscripts;

DROP POLICY IF EXISTS "Role-based SELECT access" ON public.manuscripts;
CREATE POLICY "Role-based SELECT access"
  ON public.manuscripts FOR SELECT
  TO authenticated
  USING (
    -- Admin: Storygate-linked
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'admin_reviewer'
      AND storygate_linked = true
    )
    OR
    -- Author: own manuscripts (by created_by)
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author'
      AND created_by = (SELECT auth.uid())
    )
    OR
    -- Industry: public opted-in final manuscripts
    (
      ((SELECT current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'industry_agent'
      AND storygate_linked = true
      AND allow_industry_discovery = true
      AND is_final = true
    )
  );

-- =============================================================================
-- SECTION 2: Drop 46 unused indexes (idx_scan = 0, confirmed in pg_stat)
-- =============================================================================

-- admin_actions
DROP INDEX IF EXISTS public.idx_admin_actions_performed_at;

-- canon_chunks
DROP INDEX IF EXISTS public.canon_chunks_embedding_idx;

-- canon_documents
DROP INDEX IF EXISTS public.canon_documents_pass_scope_idx;

-- change_proposals
DROP INDEX IF EXISTS public.idx_change_proposals_decision;
DROP INDEX IF EXISTS public.idx_change_proposals_end_offset;
DROP INDEX IF EXISTS public.idx_change_proposals_start_offset;

-- chunk_evidence
DROP INDEX IF EXISTS public.chunk_evidence_chunk_history_idx;

-- collection_artifacts
DROP INDEX IF EXISTS public.idx_collection_artifacts_added_by;

-- collection_shares
DROP INDEX IF EXISTS public.idx_collection_shares_collection;

-- diagnostic_findings
DROP INDEX IF EXISTS public.idx_diagnostic_findings_action_hint;
DROP INDEX IF EXISTS public.idx_diagnostic_findings_artifact_id;
DROP INDEX IF EXISTS public.idx_diagnostic_findings_criterion_key;
DROP INDEX IF EXISTS public.idx_diagnostic_findings_finding_type;
DROP INDEX IF EXISTS public.idx_diagnostic_findings_location_ref;
DROP INDEX IF EXISTS public.idx_diagnostic_findings_wave_id;

-- evaluation_events
DROP INDEX IF EXISTS public.idx_evaluation_events_event_type;
DROP INDEX IF EXISTS public.idx_evaluation_events_project_id;
DROP INDEX IF EXISTS public.idx_evaluation_events_stage_run_id;

-- evaluation_jobs
DROP INDEX IF EXISTS public.evaluation_jobs_completed_at_idx;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_evaluation_project_id;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_failure_envelope;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_has_result;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_next_retry_at;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_phase_1_locked;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_result_verdict;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_user_id;

-- evaluation_projects
DROP INDEX IF EXISTS public.idx_evaluation_projects_status;
DROP INDEX IF EXISTS public.idx_evaluation_projects_user_id;

-- evaluation_provider_calls
DROP INDEX IF EXISTS public.idx_provider_calls_job_id;
DROP INDEX IF EXISTS public.idx_provider_calls_provider_phase;

-- evaluation_stage_runs
DROP INDEX IF EXISTS public.idx_evaluation_stage_runs_project_id;
DROP INDEX IF EXISTS public.idx_evaluation_stage_runs_stage_key;
DROP INDEX IF EXISTS public.idx_evaluation_stage_runs_status;

-- governance_logs
DROP INDEX IF EXISTS public.governance_logs_chapter_id_idx;
DROP INDEX IF EXISTS public.governance_logs_scene_id_idx;

-- job_leases
DROP INDEX IF EXISTS public.idx_job_leases_expires;

-- manuscript_chunks
DROP INDEX IF EXISTS public.idx_manuscript_chunks_attempts;
DROP INDEX IF EXISTS public.idx_manuscript_chunks_lease_expires_at;
DROP INDEX IF EXISTS public.idx_manuscript_chunks_recovery;
DROP INDEX IF EXISTS public.idx_manuscript_chunks_status_lease;

-- protected_spans
DROP INDEX IF EXISTS public.protected_spans_scene_id_idx;

-- revision_events
DROP INDEX IF EXISTS public.idx_revision_events_changes;
DROP INDEX IF EXISTS public.idx_revision_events_event_type;
DROP INDEX IF EXISTS public.idx_revision_events_manuscript_id;
DROP INDEX IF EXISTS public.idx_revision_events_manuscript_version_id;

-- wave_runs
DROP INDEX IF EXISTS public.idx_wave_runs_wave_number;
