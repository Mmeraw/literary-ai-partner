-- =============================================================================
-- Migration: Hardening Round 2
-- Date: 2026-05-22
-- Changes:
--   P2-B continued: Replace bare auth.uid() with (select auth.uid()) in all
--     remaining RLS policies not covered by the first hardening migration.
--     Affected tables (13): analytics, artifact_collections, change_proposals,
--     collection_artifacts, collection_shares, diagnostic_findings,
--     manuscript_versions, report_shares, revision_sessions,
--     user_activity_events, wave_runs, evaluations (INSERT open policy)
--   P0-C continued: REVOKE anon EXECUTE from worker + admin SECURITY DEFINER
--     functions that have no business being callable without authentication.
--     Two public share functions (get_public_artifact_collection,
--     get_public_report_share) intentionally retain anon access.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: analytics
-- bare: user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Author: view own analytics" ON public.analytics;

CREATE POLICY "Author: view own analytics"
  ON public.analytics FOR SELECT TO public
  USING (
    (((current_setting('request.jwt.claims', true))::jsonb ->> 'role') = 'author')
    AND user_id = (select auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: artifact_collections
-- bare: created_by = auth.uid() (USING + WITH CHECK)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Owner: full access to own collections" ON public.artifact_collections;

CREATE POLICY "Owner: full access to own collections"
  ON public.artifact_collections FOR ALL TO public
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: change_proposals (3 policies)
-- bare: m.created_by = auth.uid() OR m.user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own change proposals"   ON public.change_proposals;
DROP POLICY IF EXISTS "Users can insert own change proposals" ON public.change_proposals;
DROP POLICY IF EXISTS "Users can update own change proposals" ON public.change_proposals;

CREATE POLICY "Users can view own change proposals"
  ON public.change_proposals FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can insert own change proposals"
  ON public.change_proposals FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can update own change proposals"
  ON public.change_proposals FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = change_proposals.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: collection_artifacts
-- bare: artifact_collections.created_by = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Owner: manage artifacts in own collections" ON public.collection_artifacts;

CREATE POLICY "Owner: manage artifacts in own collections"
  ON public.collection_artifacts FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1 FROM artifact_collections
      WHERE artifact_collections.id = collection_artifacts.collection_id
        AND artifact_collections.created_by = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artifact_collections
      WHERE artifact_collections.id = collection_artifacts.collection_id
        AND artifact_collections.created_by = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: collection_shares
-- bare: created_by = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Owner: manage own collection shares" ON public.collection_shares;

CREATE POLICY "Owner: manage own collection shares"
  ON public.collection_shares FOR ALL TO public
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: diagnostic_findings (3 policies)
-- bare: m.created_by = auth.uid() OR m.user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own diagnostic findings"   ON public.diagnostic_findings;
DROP POLICY IF EXISTS "Users can insert own diagnostic findings" ON public.diagnostic_findings;
DROP POLICY IF EXISTS "Users can update own diagnostic findings" ON public.diagnostic_findings;

CREATE POLICY "Users can view own diagnostic findings"
  ON public.diagnostic_findings FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can insert own diagnostic findings"
  ON public.diagnostic_findings FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can update own diagnostic findings"
  ON public.diagnostic_findings FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: manuscript_versions (2 policies)
-- bare: m.created_by = auth.uid() OR m.user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own manuscript versions"   ON public.manuscript_versions;
DROP POLICY IF EXISTS "Users can insert own manuscript versions" ON public.manuscript_versions;

CREATE POLICY "Users can view own manuscript versions"
  ON public.manuscript_versions FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = manuscript_versions.manuscript_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can insert own manuscript versions"
  ON public.manuscript_versions FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = manuscript_versions.manuscript_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 8: report_shares (3 policies)
-- bare: created_by = auth.uid(), m.user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "report_shares_select_owner_only" ON public.report_shares;
DROP POLICY IF EXISTS "report_shares_update_owner_only" ON public.report_shares;
DROP POLICY IF EXISTS "report_shares_insert_owner_only" ON public.report_shares;

CREATE POLICY "report_shares_select_owner_only"
  ON public.report_shares FOR SELECT TO public
  USING ((select auth.uid()) = created_by);

CREATE POLICY "report_shares_update_owner_only"
  ON public.report_shares FOR UPDATE TO public
  USING ((select auth.uid()) = created_by)
  WITH CHECK ((select auth.uid()) = created_by);

CREATE POLICY "report_shares_insert_owner_only"
  ON public.report_shares FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = created_by
    AND EXISTS (
      SELECT 1
      FROM evaluation_jobs j
      JOIN manuscripts m ON m.id = j.manuscript_id
      WHERE j.id = report_shares.job_id
        AND m.user_id = (select auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 9: revision_sessions (3 policies)
-- bare: m.created_by = auth.uid() OR m.user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own revision sessions"   ON public.revision_sessions;
DROP POLICY IF EXISTS "Users can insert own revision sessions" ON public.revision_sessions;
DROP POLICY IF EXISTS "Users can update own revision sessions" ON public.revision_sessions;

CREATE POLICY "Users can view own revision sessions"
  ON public.revision_sessions FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can insert own revision sessions"
  ON public.revision_sessions FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can update own revision sessions"
  ON public.revision_sessions FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM manuscript_versions mv
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = revision_sessions.source_version_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 10: user_activity_events (3 policies)
-- bare: auth.uid() = user_id
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "user_activity_events_select_own" ON public.user_activity_events;
DROP POLICY IF EXISTS "user_activity_events_insert_own" ON public.user_activity_events;
DROP POLICY IF EXISTS "user_activity_events_delete_own" ON public.user_activity_events;

CREATE POLICY "user_activity_events_select_own"
  ON public.user_activity_events FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_activity_events_insert_own"
  ON public.user_activity_events FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user_activity_events_delete_own"
  ON public.user_activity_events FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 11: wave_runs (3 policies)
-- bare: m.created_by = auth.uid() OR m.user_id = auth.uid()
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view own wave runs"   ON public.wave_runs;
DROP POLICY IF EXISTS "Users can insert own wave runs" ON public.wave_runs;
DROP POLICY IF EXISTS "Users can update own wave runs" ON public.wave_runs;

CREATE POLICY "Users can view own wave runs"
  ON public.wave_runs FOR SELECT TO public
  USING (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can insert own wave runs"
  ON public.wave_runs FOR INSERT TO public
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

CREATE POLICY "Users can update own wave runs"
  ON public.wave_runs FOR UPDATE TO public
  USING (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM revision_sessions rs
      JOIN manuscript_versions mv ON mv.id = rs.source_version_id
      JOIN manuscripts m ON m.id = mv.manuscript_id
      WHERE rs.id = wave_runs.revision_session_id
        AND (m.created_by = (select auth.uid()) OR m.user_id = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 12: evaluations — fix open INSERT (WITH CHECK (true))
-- Any authenticated user can insert an evaluation for any manuscript.
-- Tighten: must own the manuscript they're evaluating.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.evaluations;

CREATE POLICY "Authenticated: insert own evaluations"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) IS NOT NULL
    AND user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM manuscripts m
      WHERE m.id = evaluations.manuscript_id
        AND (m.user_id = (select auth.uid()) OR m.created_by = (select auth.uid()))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 13: FUNCTION SECURITY — REVOKE anon from worker/admin/internal RPCs
--
-- Worker RPCs: only service_role Workers call these via CRON_SECRET.
--   Revoking anon + authenticated is safe — the Next.js workers use
--   service_role client (SUPABASE_SERVICE_ROLE_KEY).
--
-- Admin RPCs: admin_list_jobs, admin_retry_job — these have internal role
--   checks but revoking anon prevents even unauthenticated enumeration.
--   Keeping authenticated so future admin UI (same supabaseClient) works.
--
-- User-facing share RPCs: create_report_share, share_artifact_collection,
--   revoke_*_by_token — authenticated users only, never anon.
--
-- Trigger functions: evaluation_artifacts_timestamps_guard/insert — these
--   fire via trigger, not RPC. Revoking PUBLIC is safe; trigger executor
--   does not use role-based EXECUTE checks.
--
-- INTENTIONALLY NOT revoked (public share link RPCs):
--   get_public_artifact_collection — unauthenticated share link viewers
--   get_public_report_share       — unauthenticated share link viewers
-- ─────────────────────────────────────────────────────────────────────────────

-- Worker RPCs → service_role only
REVOKE EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer)            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer)            FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer)            FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_chunk_for_processing(uuid, uuid, integer)            TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamptz) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_evaluation_job_by_id(uuid, text, uuid, timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_phase1(uuid, text, integer)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_phase1(uuid, text, integer)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_phase1(uuid, text, integer)          FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_evaluation_job_phase1(uuid, text, integer)          TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_phase2(uuid, text, integer)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_phase2(uuid, text, integer)          FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_job_phase2(uuid, text, integer)          FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_evaluation_job_phase2(uuid, text, integer)          TO service_role;

-- claim_evaluation_jobs has 2 overloads
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, integer)             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, integer)             FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, integer)             FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, integer)             TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamptz)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamptz)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamptz)  FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_evaluation_jobs(integer, text, uuid, timestamptz)  TO service_role;

REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)   FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_job_failure_atomic(uuid, text, text, boolean)   TO service_role;

REVOKE EXECUTE ON FUNCTION public.renew_lease(uuid, text, uuid, timestamptz, integer)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.renew_lease(uuid, text, uuid, timestamptz, integer)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.renew_lease(uuid, text, uuid, timestamptz, integer)      FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.renew_lease(uuid, text, uuid, timestamptz, integer)      TO service_role;

-- get_queue_health_snapshot — already revoked in previous migration; re-assert
REVOKE EXECUTE ON FUNCTION public.get_queue_health_snapshot()                               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_queue_health_snapshot()                               FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_queue_health_snapshot()                               FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.get_queue_health_snapshot()                               TO service_role;

-- Trigger functions — revoke PUBLIC; triggers fire as definer, not via RPC role
REVOKE EXECUTE ON FUNCTION public.evaluation_artifacts_timestamps_guard()                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluation_artifacts_timestamps_guard()                   FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluation_artifacts_timestamps_guard()                   FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.evaluation_artifacts_timestamps_insert()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.evaluation_artifacts_timestamps_insert()                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.evaluation_artifacts_timestamps_insert()                  FROM authenticated;

-- Internal diagnostic — service_role only
REVOKE EXECUTE ON FUNCTION public.verify_phase2e_rls_policies()                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_phase2e_rls_policies()                             FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_phase2e_rls_policies()                             FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.verify_phase2e_rls_policies()                             TO service_role;

-- Admin RPCs → revoke anon, keep authenticated (admin UI uses authenticated client)
REVOKE EXECUTE ON FUNCTION public.admin_list_jobs(text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_jobs(text, text, text, text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, uuid, integer) FROM anon;

-- admin_retry_job — 2 overloads
REVOKE EXECUTE ON FUNCTION public.admin_retry_job(uuid)                                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_retry_job(uuid)                                     FROM anon;

REVOKE EXECUTE ON FUNCTION public.admin_retry_job(uuid, text, uuid)                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_retry_job(uuid, text, uuid)                        FROM anon;

-- User-facing share RPCs → authenticated only, never anon
REVOKE EXECUTE ON FUNCTION public.create_report_share(uuid, integer)                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_report_share(uuid, integer)                        FROM anon;

REVOKE EXECUTE ON FUNCTION public.share_artifact_collection(uuid, integer)                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.share_artifact_collection(uuid, integer)                  FROM anon;

REVOKE EXECUTE ON FUNCTION public.revoke_collection_share_by_token(text)                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_collection_share_by_token(text)                    FROM anon;

REVOKE EXECUTE ON FUNCTION public.revoke_report_share_by_token(text)                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_report_share_by_token(text)                        FROM anon;
