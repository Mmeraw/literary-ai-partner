-- Migration: Restore evaluation_artifacts columns dropped by bad drift migration
-- Reason: 20260205175822_remote_schema.sql was an auto-generated Supabase remote schema pull
--         that destructively dropped columns the production code (lib/jobs/phase2.ts) depends on.
-- Impact: Phase 2 jobs have been silently failing because writes reference missing columns.
-- This migration restores the canonical schema to match production code expectations.
--
-- Created: 2026-02-15
-- Priority: P0 (blocks Phase 2 persistence and artifact rendering)

-- Restore dropped columns
ALTER TABLE public.evaluation_artifacts
ADD COLUMN IF NOT EXISTS manuscript_id BIGINT REFERENCES public.manuscripts(id) ON DELETE CASCADE;

ALTER TABLE public.evaluation_artifacts
ADD COLUMN IF NOT EXISTS artifact_version TEXT NOT NULL DEFAULT 'v1';

ALTER TABLE public.evaluation_artifacts
ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.evaluation_artifacts
ADD COLUMN IF NOT EXISTS source_hash TEXT;

ALTER TABLE public.evaluation_artifacts
ADD COLUMN IF NOT EXISTS source_phase TEXT;

ALTER TABLE public.evaluation_artifacts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Drop the orphan column that nothing in the codebase uses
ALTER TABLE public.evaluation_artifacts
DROP COLUMN IF EXISTS artifact_payload;

-- Restore the unique index required for onConflict upserts in phase2.ts
-- This index was present in the canonical schema (20260124000000_evaluation_artifacts.sql)
-- and is critical for idempotent Phase 2 writes.
CREATE UNIQUE INDEX IF NOT EXISTS unique_job_artifact 
  ON public.evaluation_artifacts (job_id, artifact_type);

-- Restore manuscript_id index for artifact queries by manuscript
CREATE INDEX IF NOT EXISTS idx_evaluation_artifacts_manuscript_id 
  ON public.evaluation_artifacts (manuscript_id);

-- Add COMMENT explaining the schema
COMMENT ON TABLE public.evaluation_artifacts IS
  'Phase 2 output artifacts with db-level idempotency via UNIQUE(job_id, artifact_type). 
   Schema restored from canonical state (20260124000000); drift migration (20260205175822_remote_schema.sql) dropped these incorrectly.';
