-- Migration: manuscript_chunks table + heartbeat fields on evaluation_jobs
-- Date: 2026-01-22
-- Purpose: Enable chunked manuscript processing with per-chunk progress tracking
-- Updated: adds resume/skip-completed support (attempt_count + last_error) in an idempotent way

-- 1) Enum for chunk status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chunk_status') THEN
    CREATE TYPE chunk_status AS ENUM ('pending', 'processing', 'done', 'failed');
  END IF;
END $$;

-- 2) Chunks table (initial create shape)
CREATE TABLE IF NOT EXISTS public.manuscript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  manuscript_id integer NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,

  chunk_index integer NOT NULL,                 -- 0-based index
  char_start integer NOT NULL,                  -- inclusive in staged text
  char_end integer NOT NULL,                    -- exclusive in staged text

  overlap_chars integer NOT NULL DEFAULT 0,     -- how much overlap was included
  label text NULL,                              -- optional: "Chapter 4", "Scene 12", etc.

  content text NOT NULL,                        -- includes overlap at the beginning when overlap_chars > 0
  content_hash text NOT NULL,                   -- sha256 (or equivalent) for idempotency/integrity

  status chunk_status NOT NULL DEFAULT 'pending',

  -- Resume / retry support
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text NULL,
  processing_started_at timestamptz NULL,  -- For lease-based timeout recovery

  result_json jsonb NULL,                       -- Phase 1 per-chunk output

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2b) Idempotent upgrades if table already existed (add missing cols / optional rename)
DO $$
BEGIN
  -- attempt_count
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manuscript_chunks'
      AND column_name = 'attempt_count'
  ) THEN
    ALTER TABLE public.manuscript_chunks
      ADD COLUMN attempt_count integer NOT NULL DEFAULT 0;
  END IF;

  -- last_error
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manuscript_chunks'
      AND column_name = 'last_error'
  ) THEN
    ALTER TABLE public.manuscript_chunks
      ADD COLUMN last_error text NULL;
  END IF;

  -- result_json (in case an older version omitted it)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manuscript_chunks'
      AND column_name = 'result_json'
  ) THEN
    ALTER TABLE public.manuscript_chunks
      ADD COLUMN result_json jsonb NULL;
  END IF;

  -- updated_at (in case an older version omitted it)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manuscript_chunks'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.manuscript_chunks
      ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;

  -- processing_started_at (for lease-based timeout recovery)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manuscript_chunks'
      AND column_name = 'processing_started_at'
  ) THEN
    ALTER TABLE public.manuscript_chunks
      ADD COLUMN processing_started_at timestamptz NULL;
  END IF;

  -- If an earlier migration used "error" instead of "last_error", preserve data safely.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manuscript_chunks'
      AND column_name = 'error'
  ) THEN
    -- Only copy if last_error is currently NULL (don’t overwrite anything)
    EXECUTE $copy$
      UPDATE public.manuscript_chunks
      SET last_error = COALESCE(last_error, error)
      WHERE error IS NOT NULL
    $copy$;

    -- Keep the legacy column if other code still references it.
    -- If you want to fully remove it later, do it in a dedicated cleanup migration.
  END IF;
END $$;

-- 3) Ensure stable uniqueness per manuscript
CREATE UNIQUE INDEX IF NOT EXISTS manuscript_chunks_unique_idx
  ON public.manuscript_chunks (manuscript_id, chunk_index);

-- 4) Helpful lookup indexes
CREATE INDEX IF NOT EXISTS manuscript_chunks_manuscript_idx
  ON public.manuscript_chunks (manuscript_id);

CREATE INDEX IF NOT EXISTS manuscript_chunks_status_idx
  ON public.manuscript_chunks (manuscript_id, status);

-- Optional: helps resume/retry scans
CREATE INDEX IF NOT EXISTS manuscript_chunks_retry_idx
  ON public.manuscript_chunks (manuscript_id, status, attempt_count);

-- Optional: helps identify stuck processing chunks (lease timeout)
CREATE INDEX IF NOT EXISTS manuscript_chunks_processing_started_idx
  ON public.manuscript_chunks (processing_started_at)
  WHERE status = 'processing';

-- 5) updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS manuscript_chunks_set_updated_at ON public.manuscript_chunks;
CREATE TRIGGER manuscript_chunks_set_updated_at
BEFORE UPDATE ON public.manuscript_chunks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6) Heartbeat and progress tracking fields on evaluation_jobs (if they don't already exist)
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz NULL;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS last_progress_at timestamptz NULL;

-- Optional: "partial completion" flag for trust
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS partial boolean NOT NULL DEFAULT false;

-- 7) RLS policies for manuscript_chunks (mirror manuscript policies)
ALTER TABLE public.manuscript_chunks ENABLE ROW LEVEL SECURITY;

-- Authors can view/manage chunks for their own manuscripts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manuscript_chunks'
      AND policyname = 'Author: view own manuscript chunks'
  ) THEN
    CREATE POLICY "Author: view own manuscript chunks"
      ON public.manuscript_chunks FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.manuscripts m
          WHERE m.id = manuscript_chunks.manuscript_id
            AND m.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Admins can view chunks for Storygate-linked manuscripts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manuscript_chunks'
      AND policyname = 'Admin: view Storygate manuscript chunks'
  ) THEN
    CREATE POLICY "Admin: view Storygate manuscript chunks"
      ON public.manuscript_chunks FOR SELECT
      USING (
        (current_setting('request.jwt.claims', true)::jsonb ->> 'role')::text = 'admin_reviewer'
        AND EXISTS (
          SELECT 1 FROM public.manuscripts m
          WHERE m.id = manuscript_chunks.manuscript_id
            AND m.storygate_linked = true
        )
      );
  END IF;
END $$;

-- System insert/update is handled via service role (bypasses RLS); no user-context policies added here.
