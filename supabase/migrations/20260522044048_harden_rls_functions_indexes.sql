-- =============================================================================
-- Migration: Production Hardening — RLS, Functions, Indexes, Policies
-- Date: 2026-05-22
-- Addresses: Supabase security email + full forensic audit
--
-- Defensive migration note:
-- Local/CI Supabase resets may not include every historical root-level migration.
-- This migration hardens whatever production tables/functions are present and skips
-- optional/absent objects instead of aborting the whole proof pack.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- P0-A: Enable RLS on worker/internal tables when present.
-- These tables are internal/worker-owned — service_role gets full access,
-- all other roles (anon, authenticated) are denied by default.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'job_leases',
    'pipeline_logs',
    'evaluation_projects',
    'transition_log',
    'error_policy_registry',
    'evaluation_events',
    'evaluation_stage_runs'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE NOTICE 'Skipping RLS hardening for missing table public.%', v_table;
    ELSE
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE format('DROP POLICY IF EXISTS "Service role: full access" ON public.%I', v_table);
      EXECUTE format(
        'CREATE POLICY "Service role: full access" ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

-- evaluation_projects: authenticated users can view their own projects
DO $$
BEGIN
  IF to_regclass('public.evaluation_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owner: view own evaluation projects" ON public.evaluation_projects;
    CREATE POLICY "Owner: view own evaluation projects"
      ON public.evaluation_projects FOR SELECT
      TO authenticated
      USING ((select auth.uid()) = user_id);
  ELSE
    RAISE NOTICE 'Skipping evaluation_projects owner policy; table is absent';
  END IF;
END;
$$;

-- evaluation_events: authenticated users can view events for their own projects
DO $$
BEGIN
  IF to_regclass('public.evaluation_events') IS NOT NULL
     AND to_regclass('public.evaluation_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owner: view own evaluation events" ON public.evaluation_events;
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
  ELSE
    RAISE NOTICE 'Skipping evaluation_events owner policy; dependency table is absent';
  END IF;
END;
$$;

-- evaluation_stage_runs: authenticated users can view their own stage runs
DO $$
BEGIN
  IF to_regclass('public.evaluation_stage_runs') IS NOT NULL
     AND to_regclass('public.evaluation_projects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Owner: view own evaluation stage runs" ON public.evaluation_stage_runs;
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
  ELSE
    RAISE NOTICE 'Skipping evaluation_stage_runs owner policy; dependency table is absent';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P0-B: chunk_evidence — RLS already enabled but NO policies (dead lock)
-- Worker writes via service_role. No user-facing reads needed.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.chunk_evidence') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Service role: full access" ON public.chunk_evidence;
    CREATE POLICY "Service role: full access"
      ON public.chunk_evidence FOR ALL
      TO service_role USING (true) WITH CHECK (true);
  ELSE
    RAISE NOTICE 'Skipping chunk_evidence service-role policy; table is absent';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P0-C: execute_query — SECURITY DEFINER callable by anon
-- This executes arbitrary SQL as the function owner. Restrict to service_role.
-- Any internal caller that needs it already uses service_role.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regprocedure('public.execute_query(text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.execute_query(text) FROM PUBLIC;
    REVOKE EXECUTE ON FUNCTION public.execute_query(text) FROM anon;
    REVOKE EXECUTE ON FUNCTION public.execute_query(text) FROM authenticated;
    GRANT  EXECUTE ON FUNCTION public.execute_query(text) TO service_role;
  ELSE
    RAISE NOTICE 'Skipping execute_query privilege hardening; function is absent';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P1: evaluation_jobs INSERT policy hardening
-- Current: two overlapping policies both WITH CHECK (true) — anon can insert
-- anything. Replace with a single scoped policy: authenticated only,
-- user_id must match the calling user.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Allow anon insert on evaluation_jobs"          ON public.evaluation_jobs;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only"     ON public.evaluation_jobs;
    DROP POLICY IF EXISTS "Authenticated: insert own evaluation jobs"       ON public.evaluation_jobs;

    CREATE POLICY "Authenticated: insert own evaluation jobs"
      ON public.evaluation_jobs FOR INSERT
      TO authenticated
      WITH CHECK (
        (select auth.uid()) IS NOT NULL
        AND user_id = (select auth.uid())
      );
  ELSE
    RAISE NOTICE 'Skipping evaluation_jobs insert policy; table is absent';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-A: Fix mutable search_path on public functions when present.
-- Attack vector: a malicious schema object shadows a public function.
-- Fix: pin search_path on every discovered target function.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_fn regprocedure;
BEGIN
  FOR v_fn IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(ARRAY[
        'claim_evaluation_job_phase2',
        'finalizer_complete_job_atomic',
        'execute_query',
        'enforce_evaluation_jobs_status_phase_consistent',
        'stamp_handoff_progress',
        'claim_job_atomic',
        'set_updated_at',
        'claim_lease',
        'create_artifact_collection',
        'touch_updated_at',
        '_rg_generate_share_token',
        'repair_orphaned_running_jobs',
        'finalizer_mark_job_failed',
        'set_user_preferences_updated_at',
        'release_lease',
        'atomic_transition',
        'list_my_artifacts',
        'renew_lease',
        'expire_stale_leases',
        'heartbeat_lease',
        'match_canon_chunks'
      ])
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', v_fn);
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P2-B: Fix auth.uid() per-row re-evaluation in RLS policies
-- Replace auth.uid() with (select auth.uid()) — pins value once per query,
-- not once per row. Critical at scale (100k+ users, large manuscript tables).
-- Affects: manuscripts, evaluations, manuscript_chunks, user_preferences,
--          evaluation_artifacts, access_log, evaluation_jobs
-- ─────────────────────────────────────────────────────────────────────────────

-- manuscripts
DO $$
BEGIN
  IF to_regclass('public.manuscripts') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Skipping manuscripts policies; table is absent';
  END IF;
END;
$$;

-- evaluations
DO $$
BEGIN
  IF to_regclass('public.evaluations') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view own evaluations"                    ON public.evaluations;
    DROP POLICY IF EXISTS "Author: view evaluations for own manuscripts"      ON public.evaluations;

    CREATE POLICY "Users can view own evaluations"
      ON public.evaluations FOR SELECT TO public
      USING ((select auth.uid()) = user_id);

    IF to_regclass('public.manuscripts') IS NOT NULL THEN
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
    END IF;
  ELSE
    RAISE NOTICE 'Skipping evaluations policies; table is absent';
  END IF;
END;
$$;

-- manuscript_chunks
DO $$
BEGIN
  IF to_regclass('public.manuscript_chunks') IS NOT NULL
     AND to_regclass('public.manuscripts') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Skipping manuscript_chunks policy; dependency table is absent';
  END IF;
END;
$$;

-- user_preferences
DO $$
BEGIN
  IF to_regclass('public.user_preferences') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Skipping user_preferences policies; table is absent';
  END IF;
END;
$$;

-- access_log
DO $$
BEGIN
  IF to_regclass('public.access_log') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Skipping access_log policies; table is absent';
  END IF;
END;
$$;

-- evaluation_artifacts
DO $$
BEGIN
  IF to_regclass('public.evaluation_artifacts') IS NOT NULL
     AND to_regclass('public.evaluation_jobs') IS NOT NULL
     AND to_regclass('public.manuscripts') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Skipping evaluation_artifacts policy; dependency table is absent';
  END IF;
END;
$$;

-- evaluation_jobs select policy
DO $$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NOT NULL
     AND to_regclass('public.manuscripts') IS NOT NULL THEN
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
  ELSE
    RAISE NOTICE 'Skipping evaluation_jobs select policy; dependency table is absent';
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P3-A: Add missing indexes on unindexed foreign keys when tables exist.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.evaluation_jobs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_user_id
      ON public.evaluation_jobs (user_id);
  END IF;

  IF to_regclass('public.collection_artifacts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_collection_artifacts_added_by
      ON public.collection_artifacts (added_by);
  END IF;

  IF to_regclass('public.diagnostic_findings') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_artifact_id
      ON public.diagnostic_findings (artifact_id);
  END IF;

  IF to_regclass('public.revision_events') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_id
      ON public.revision_events (manuscript_id);

    CREATE INDEX IF NOT EXISTS idx_revision_events_manuscript_version_id
      ON public.revision_events (manuscript_version_id);
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P3-B: Drop confirmed unused indexes
-- Source: Supabase performance advisor (unused index lint).
-- Verified: none of these are unique constraints or PKs — safe to drop.
-- Partial indexes with WHERE clauses are kept unless explicitly unused.
-- ─────────────────────────────────────────────────────────────────────────────

-- manuscript_chunks — overlapping/superseded indexes
DROP INDEX IF EXISTS public.manuscript_chunks_status_idx;
DROP INDEX IF EXISTS public.manuscript_chunks_status_updated_idx;

-- revision_events — flagged unused
DROP INDEX IF EXISTS public.idx_revision_events_manuscript_version_id;

-- chunk_evidence — prompt_version alone never queried in isolation
DROP INDEX IF EXISTS public.chunk_evidence_prompt_version_idx;

-- evaluation_provider_calls — provider+phase combo index supersedes individual
DROP INDEX IF EXISTS public.idx_provider_calls_created_at;

-- wave_execution_attempts — scene_id not queried standalone
DROP INDEX IF EXISTS public.wave_execution_attempts_scene_id_idx;
DROP INDEX IF EXISTS public.wave_execution_attempts_created_at_idx;

-- evaluation_jobs — overlapping/superseded indexes
DROP INDEX IF EXISTS public.idx_eval_jobs_manuscript_created;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_phase_1_status;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_progress_phase_status;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_guided_full_novel_stage;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_status_lease;
DROP INDEX IF EXISTS public.idx_evaluation_jobs_status_next_retry;

-- governance_logs — flagged unused
DROP INDEX IF EXISTS public.idx_governance_logs_job_id;
DROP INDEX IF EXISTS public.idx_governance_logs_created_at;

-- change_proposals — flagged unused
DROP INDEX IF EXISTS public.idx_change_proposals_session_id;
DROP INDEX IF EXISTS public.idx_change_proposals_manuscript_id;

-- canon_documents — GIN indexes flagged unused
DROP INDEX IF EXISTS public.canon_documents_concerns_idx;
DROP INDEX IF EXISTS public.canon_documents_scope_idx;

-- collection_shares — duplicate token_hash index (unique already covers it)
DROP INDEX IF EXISTS public.idx_collection_shares_token_hash;

-- ─────────────────────────────────────────────────────────────────────────────
-- P4: Consolidate duplicate permissive policies on manuscripts
-- manuscripts has both "Users can view own manuscripts" (auth.uid()=user_id)
-- and "Author: view own manuscripts" (role=author AND created_by=auth.uid()).
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
