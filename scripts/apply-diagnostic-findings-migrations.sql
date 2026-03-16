-- ============================================================
-- Supabase SQL Editor: Diagnostic Findings Layer Migrations
-- Project: xtumxjnzdswuumndcbwc (RevisionGrade Production)
-- Files:
--   20260316020000_add_diagnostic_findings.sql
--   20260316021000_diagnostic_findings_rls.sql
--
-- HOW TO APPLY:
--   1. Open https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/sql
--   2. Click "New query"
--   3. Paste this ENTIRE file
--   4. Click "Run"
--   5. Confirm the verification output at the bottom shows:
--        diagnostic_findings | t
--      and all expected indexes listed
--   6. Restart your local dev server
--   7. Rerun:  node scripts/revision-stage2-smoke.mjs
--
-- This script is idempotent (CREATE TABLE IF NOT EXISTS,
-- DROP POLICY IF EXISTS, CREATE INDEX IF NOT EXISTS).
-- Safe to run multiple times.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- MIGRATION 1: 20260316020000_add_diagnostic_findings.sql
-- Stage 2 additive architecture improvement:
--   evaluation_artifacts -> diagnostic_findings -> change_proposals
-- ──────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS public.diagnostic_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_job_id uuid NOT NULL REFERENCES public.evaluation_jobs(id) ON DELETE CASCADE,
  manuscript_version_id uuid REFERENCES public.manuscript_versions(id) ON DELETE SET NULL,
  artifact_id uuid REFERENCES public.evaluation_artifacts(id) ON DELETE SET NULL,

  criterion_key text NOT NULL,
  wave_id text,
  finding_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  confidence numeric,

  location_ref text,
  chunk_id uuid,
  chapter_index integer,
  paragraph_index integer,
  sentence_index integer,

  original_text text,
  evidence_excerpt text,
  diagnosis text NOT NULL,
  recommendation text,

  action_hint text CHECK (action_hint IN ('preserve', 'refine', 'replace')),
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_evaluation_job_id
  ON public.diagnostic_findings(evaluation_job_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_manuscript_version_id
  ON public.diagnostic_findings(manuscript_version_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_criterion_key
  ON public.diagnostic_findings(criterion_key);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_wave_id
  ON public.diagnostic_findings(wave_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_finding_type
  ON public.diagnostic_findings(finding_type);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_status
  ON public.diagnostic_findings(status);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_location_ref
  ON public.diagnostic_findings(location_ref);

CREATE INDEX IF NOT EXISTS idx_diagnostic_findings_action_hint
  ON public.diagnostic_findings(action_hint);

COMMIT;

-- ──────────────────────────────────────────────────────────
-- MIGRATION 2: 20260316021000_diagnostic_findings_rls.sql
-- Stage 2 RLS hardening for diagnostic_findings
-- ──────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.diagnostic_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own diagnostic findings" ON public.diagnostic_findings;
CREATE POLICY "Users can view own diagnostic findings"
  ON public.diagnostic_findings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can insert own diagnostic findings" ON public.diagnostic_findings;
CREATE POLICY "Users can insert own diagnostic findings"
  ON public.diagnostic_findings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

DROP POLICY IF EXISTS "Users can update own diagnostic findings" ON public.diagnostic_findings;
CREATE POLICY "Users can update own diagnostic findings"
  ON public.diagnostic_findings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.manuscript_versions mv
      JOIN public.manuscripts m ON m.id = mv.manuscript_id
      WHERE mv.id = diagnostic_findings.manuscript_version_id
        AND (
          m.created_by = auth.uid()
          OR m.user_id = auth.uid()
        )
    )
  );

COMMIT;

-- ──────────────────────────────────────────────────────────
-- POST-MIGRATION: Reload PostgREST schema cache
-- ──────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

-- ──────────────────────────────────────────────────────────
-- VERIFICATION: Confirm the table and indexes exist
-- Expected output: diagnostic_findings | t
-- and 8 index rows
-- ──────────────────────────────────────────────────────────

SELECT
  c.relname AS table_name,
  obj_description(c.oid, 'pg_class') AS comment,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'diagnostic_findings';

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'diagnostic_findings'
ORDER BY indexname;

SELECT
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'diagnostic_findings'
ORDER BY policyname;
