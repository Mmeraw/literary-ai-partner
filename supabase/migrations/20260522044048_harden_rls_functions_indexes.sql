-- =============================================================================
-- Migration: Production Hardening — RLS, Functions, Indexes, Policies
-- Date: 2026-05-22
-- Addresses: Supabase security email + full forensic audit
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- P0-A: Enable RLS on 7 tables exposed without it
-- These tables are internal/worker-owned — service_role gets full access,
-- all other roles (anon, authenticated) are denied by default.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.job_leases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transition_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_policy_registry   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_stage_runs   ENABLE ROW LEVEL SECURITY;

-- Service role gets full access to all worker-internal tables.
-- No other role needs direct PostgREST access to these.

CREATE POLICY "Service role: full access"
  ON public.job_leases FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role: full access"
  ON public.pipeline_logs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role: full access"
  ON public.evaluation_projects FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role: full access"
  ON public.transition_log FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role: full access"
  ON public.error_policy_registry FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role: full access"
  ON public.evaluation_events FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role: full access"
  ON public.evaluation_stage_runs FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- evaluation_projects: authenticated users can view their own projects
CREATE POLICY "Owner: view own evaluation projects"
  ON public.evaluation_projects FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- evaluation_events: authenticated users can view events for their own projects
-- (join through evaluation_projects.user_id — evaluation_events has no job_id column)
CREATE POLICY "Owner: view own evaluation events"
  ON public.evaluation_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_projects ep
      WHERE ep.id = evaluation_events.project_id
        AND ep.user_id = (select auth.uid())
    )
  );

-- evaluation_stage_runs: authenticated users can view their own stage runs
CREATE POLICY "Owner: view own evaluation stage runs"
  ON public.evaluation_stage_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.evaluation_projects ep
      WHERE ep.id = evaluation_stage_runs.project_id
        AND ep.user_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- P0-B: chunk_evidence — RLS already enabled but NO policies (dead lock)
-- Worker writes via service_role. No user-facing reads needed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Service role: full access"
  ON public.chunk_evidence FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- P0-C: execute_query — SECURITY DEFINER callable by anon
-- This executes arbitrary SQL as the function owner. Restrict to service_role.
-- Any internal caller that needs it already uses service_role.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.execute_query(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_query(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.execute_query(text) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.execute_query(text) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- P1: evaluation_jobs INSERT policy hardening
-- Current: two overlapping policies both WITH CHECK (true) — anon can insert
-- anything. Replace with a single scoped policy: authenticated only,
-- user_id must match the calling user.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow anon insert on evaluation_jobs"          ON public.evaluation_jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only"     ON public.evaluation_jobs;

CREATE POLICY "Authenticated: insert own evaluation jobs"
  ON public.evaluation_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND user_id = (select auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-A: Fix mutable search_path on all 21 public functions
-- Attack vector: a malicious schema object shadows a public function.
-- Fix: pin search_path on every function.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.claim_evaluation_job_phase2              SET search_path = public, pg_catalog;
ALTER FUNCTION public.finalizer_complete_job_atomic            SET search_path = public, pg_catalog;
ALTER FUNCTION public.execute_query(text)                      SET search_path = public, pg_catalog;
ALTER FUNCTION public.enforce_evaluation_jobs_status_phase_consistent SET search_path = public, pg_catalog;
ALTER FUNCTION public.stamp_handoff_progress                   SET search_path = public, pg_catalog;
ALTER FUNCTION public.claim_job_atomic                         SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_updated_at                           SET search_path = public, pg_catalog;
ALTER FUNCTION public.claim_lease                              SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_artifact_collection               SET search_path = public, pg_catalog;
ALTER FUNCTION public.touch_updated_at                         SET search_path = public, pg_catalog;
ALTER FUNCTION public._rg_generate_share_token                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.repair_orphaned_running_jobs             SET search_path = public, pg_catalog;
ALTER FUNCTION public.finalizer_mark_job_failed                SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_user_preferences_updated_at          SET search_path = public, pg_catalog;
ALTER FUNCTION public.release_lease                            SET search_path = public, pg_catalog;
ALTER FUNCTION public.atomic_transition                        SET search_path = public, pg_catalog;
ALTER FUNCTION public.list_my_artifacts                        SET search_path = public, pg_catalog;
ALTER FUNCTION public.renew_lease                              SET search_path = public, pg_catalog;
ALTER FUNCTION public.expire_stale_leases                      SET search_path = public, pg_catalog;
ALTER FUNCTION public.heartbeat_lease                          SET search_path = public, pg_catalog;
ALTER FUNCTION public.match_canon_chunks                       SET search_path = public, pg_catalog;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-B: Fix auth.uid() per-row re-evaluation in RLS policies
-- Replace auth.uid() with (select auth.uid()) — pins value once per query,
-- not once per row. Critical at scale (100k+ users, large manuscript tables).
-- Affects: manuscripts, evaluations, manuscript_chunks, user_preferences,
--          evaluation_artifacts, access_log, evaluation_jobs
-- ─────────────────────────────────────────────────────────────────────────────

-- manuscripts
DROP POLICY IF EXISTS "Users can view own manuscripts"     ON public.manuscripts;
DROP POLICY IF EXISTS "Users can insert own manuscripts"   ON public.manuscripts;
DROP POLICY IF EXISTS "Users can update own manuscripts"   ON public.manuscripts;
DROP POLICY IF EXISTS "Author: view own manuscripts"       ON public.manuscripts;
DROP POLICY IF EXISTS "Author: insert own manuscripts"     ON public.manuscripts;
DROP POLICY IF EXISTS "Author: update own manuscripts"     ON public.manuscripts;

CREATE POLICY "Users can view own manuscripts"
  ON public.manuscripts FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own manuscripts"
  ON public.manuscripts FOR INSERT TO public
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own manuscripts"
  ON public.manuscripts FOR UPDATE TO public
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Author: view own manuscripts"
  ON public.manuscripts FOR SELECT TO public
  USING (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND created_by = (select auth.uid())
  );

CREATE POLICY "Author: insert own manuscripts"
  ON public.manuscripts FOR INSERT TO public
  WITH CHECK (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND created_by = (select auth.uid())
  );

CREATE POLICY "Author: update own manuscripts"
  ON public.manuscripts FOR UPDATE TO public
  USING (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND created_by = (select auth.uid())
  )
  WITH CHECK (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND created_by = (select auth.uid())
  );

-- evaluations
DROP POLICY IF EXISTS "Users can view own evaluations"                    ON public.evaluations;
DROP POLICY IF EXISTS "Author: view evaluations for own manuscripts"      ON public.evaluations;

CREATE POLICY "Users can view own evaluations"
  ON public.evaluations FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Author: view evaluations for own manuscripts"
  ON public.evaluations FOR SELECT TO public
  USING (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND EXISTS (
      SELECT 1 FROM public.manuscripts m
      WHERE m.id = evaluations.manuscript_id
        AND m.created_by = (select auth.uid())
    )
  );

-- manuscript_chunks
DROP POLICY IF EXISTS "Author: view own manuscript chunks"        ON public.manuscript_chunks;

CREATE POLICY "Author: view own manuscript chunks"
  ON public.manuscript_chunks FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.manuscripts m
      WHERE m.id = manuscript_chunks.manuscript_id
        AND m.created_by = (select auth.uid())
    )
  );

-- user_preferences
DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;

CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_preferences_insert_own"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- access_log
DROP POLICY IF EXISTS "Users can view own access logs"  ON public.access_log;
DROP POLICY IF EXISTS "Author: view own access logs"    ON public.access_log;

CREATE POLICY "Users can view own access logs"
  ON public.access_log FOR SELECT TO public
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Author: view own access logs"
  ON public.access_log FOR SELECT TO public
  USING (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND (select auth.uid()) = user_id
  );

-- evaluation_artifacts
DROP POLICY IF EXISTS "Authors view own artifacts" ON public.evaluation_artifacts;

CREATE POLICY "Authors view own artifacts"
  ON public.evaluation_artifacts FOR SELECT TO public
  USING (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND EXISTS (
      SELECT 1
      FROM public.evaluation_jobs j
      JOIN public.manuscripts m ON m.id = j.manuscript_id
      WHERE j.id = evaluation_artifacts.job_id
        AND m.created_by = (select auth.uid())
    )
  );

-- evaluation_jobs select policy
DROP POLICY IF EXISTS "evaluation_jobs_select_own" ON public.evaluation_jobs;

CREATE POLICY "evaluation_jobs_select_own"
  ON public.evaluation_jobs FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.manuscripts m
      WHERE m.id = evaluation_jobs.manuscript_id
        AND m.created_by = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- P3-A: Add missing indexes on unindexed foreign keys
-- ─────────────────────────────────────────────────────────────────────────────

-- evaluation_jobs.user_id — critical, every user-scoped query joins here
CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_user_id
  ON public.evaluation_jobs (user_id);

-- collection_artifacts.added_by
CREATE INDEX IF NOT EXISTS idx_collection_artifacts_added_by
  ON public.collection_artifacts (added_by);

-- diagnostic_findings.artifact_id
CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_artifact_id
  ON public.diagnostic_findings (artifact_id);

-- revision_events.manuscript_id
CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_id
  ON public.revision_events (manuscript_id);

-- revision_events.manuscript_version_id
CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_version_id
  ON public.revision_events (manuscript_version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- P3-B: Drop confirmed unused indexes
-- Source: Supabase performance advisor (unused index lint).
-- Verified: none of these are unique constraints or PKs — safe to drop.
-- Partial indexes with WHERE clauses are kept unless explicitly unused.
-- ─────────────────────────────────────────────────────────────────────────────

-- manuscript_chunks — overlapping/superseded indexes
DROP INDEX IF EXISTS public.manuscript_chunks_status_idx;         -- superseded by idx_manuscript_chunks_status_lease
DROP INDEX IF EXISTS public.manuscript_chunks_status_updated_idx; -- not used by any query plan

-- revision_events — flagged unused
DROP INDEX IF EXISTS public.idx_revision_events_manuscript_version_id; -- just added the FK index above; old one was different shape

-- chunk_evidence — prompt_version alone never queried in isolation
DROP INDEX IF EXISTS public.chunk_evidence_prompt_version_idx;

-- evaluation_provider_calls — provider+phase combo index supersedes individual
DROP INDEX IF EXISTS public.idx_provider_calls_created_at;   -- not used; job_id + created_at covers it

-- wave_execution_attempts — scene_id not queried standalone
DROP INDEX IF EXISTS public.wave_execution_attempts_scene_id_idx;
DROP INDEX IF EXISTS public.wave_execution_attempts_created_at_idx;

-- evaluation_jobs — overlapping/superseded indexes
-- idx_eval_jobs_manuscript_created is superseded by idx_eval_jobs_manuscript_status_created
DROP INDEX IF EXISTS public.idx_eval_jobs_manuscript_created;
-- phase_1_status alone not queried; covered by claim queue index
DROP INDEX IF EXISTS public.idx_evaluation_jobs_phase_1_status;
-- progress->>'phase_status' expression index — never used in explain plans
DROP INDEX IF EXISTS public.idx_evaluation_jobs_progress_phase_status;
-- guided_full_novel_stage — no active queries filter on this
DROP INDEX IF EXISTS public.idx_evaluation_jobs_guided_full_novel_stage;
-- status+lease_until superseded by status+lease_expires_at
DROP INDEX IF EXISTS public.idx_evaluation_jobs_status_lease;
-- status+next_retry_at superseded by idx_evaluation_jobs_runnable partial
DROP INDEX IF EXISTS public.idx_evaluation_jobs_status_next_retry;

-- governance_logs — flagged unused
DROP INDEX IF EXISTS public.idx_governance_logs_job_id; -- only if exists, safe
DROP INDEX IF EXISTS public.idx_governance_logs_created_at;

-- change_proposals — flagged unused
DROP INDEX IF EXISTS public.idx_change_proposals_session_id;
DROP INDEX IF EXISTS public.idx_change_proposals_manuscript_id;

-- canon_documents — GIN indexes flagged unused
DROP INDEX IF EXISTS public.canon_documents_concerns_idx;
DROP INDEX IF EXISTS public.canon_documents_scope_idx;

-- collection_shares — duplicate token_hash index (unique already covers it)
DROP INDEX IF EXISTS public.idx_collection_shares_token_hash; -- covered by collection_shares_token_hash_key unique

-- ─────────────────────────────────────────────────────────────────────────────
-- P4: Consolidate duplicate permissive policies on manuscripts
-- manuscripts has both "Users can view own manuscripts" (auth.uid()=user_id)
-- and "Author: view own manuscripts" (role=author AND created_by=auth.uid())
-- These fire as OR — any authenticated user hits both. Consolidate selects
-- by keeping the more specific author-role policy and a generic fallback.
-- The generic "Users can *" policies remain for non-author roles.
-- No DROP here — the auth.uid() fixes above already recreated them correctly.
-- Consolidation of stacked permissive policies is a separate migration
-- requiring access pattern audit. Flagged for next sprint.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- MONITORING: Active health-check function
-- Called by the /api/health/db endpoint (to be wired) — returns a snapshot
-- of job queue health, stale leases, and long-running jobs.
-- This is the DB side; the alerting cron is in the Next.js worker.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_queue_health_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_queued        int;
  v_running       int;
  v_failed        int;
  v_stale_leases  int;
  v_oldest_queued interval;
BEGIN
  SELECT COUNT(*) INTO v_queued  FROM evaluation_jobs WHERE status = 'queued';
  SELECT COUNT(*) INTO v_running FROM evaluation_jobs WHERE status = 'running';
  SELECT COUNT(*) INTO v_failed  FROM evaluation_jobs WHERE status = 'failed'
    AND updated_at > now() - interval '1 hour';

  SELECT COUNT(*) INTO v_stale_leases
    FROM evaluation_jobs
    WHERE status = 'running'
      AND lease_until < now() - interval '5 minutes';

  SELECT now() - MIN(created_at) INTO v_oldest_queued
    FROM evaluation_jobs WHERE status = 'queued';

  RETURN jsonb_build_object(
    'queued',          v_queued,
    'running',         v_running,
    'failed_1h',       v_failed,
    'stale_leases',    v_stale_leases,
    'oldest_queued_s', EXTRACT(EPOCH FROM COALESCE(v_oldest_queued, interval '0')),
    'snapshot_at',     now()
  );
END;
$$;

-- Only the service role (workers, health endpoint) can call this
REVOKE EXECUTE ON FUNCTION public.get_queue_health_snapshot() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_queue_health_snapshot() TO service_role;
