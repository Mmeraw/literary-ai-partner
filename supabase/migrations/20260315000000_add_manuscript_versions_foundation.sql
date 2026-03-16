-- Additive manuscript version lineage foundation (Stage 2/3 prerequisite)
-- Non-breaking: keeps manuscript_id flows intact while enabling version-bound runs.

BEGIN;

-- 1) Immutable manuscript versions table
CREATE TABLE IF NOT EXISTS public.manuscript_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id bigint NOT NULL REFERENCES public.manuscripts(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  source_version_id uuid REFERENCES public.manuscript_versions(id) ON DELETE SET NULL,
  raw_text text NOT NULL DEFAULT '',
  word_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT manuscript_versions_version_number_positive CHECK (version_number > 0),
  CONSTRAINT manuscript_versions_word_count_nonnegative CHECK (word_count >= 0),
  CONSTRAINT manuscript_versions_unique_per_manuscript UNIQUE (manuscript_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_manuscript_versions_manuscript_id
  ON public.manuscript_versions(manuscript_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_versions_source_version_id
  ON public.manuscript_versions(source_version_id);

CREATE INDEX IF NOT EXISTS idx_manuscript_versions_created_at
  ON public.manuscript_versions(created_at DESC);

-- 2) Add version binding to evaluation jobs (nullable for compatibility)
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS manuscript_version_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'evaluation_jobs'
      AND constraint_name = 'evaluation_jobs_manuscript_version_id_fkey'
  ) THEN
    ALTER TABLE public.evaluation_jobs
      ADD CONSTRAINT evaluation_jobs_manuscript_version_id_fkey
      FOREIGN KEY (manuscript_version_id)
      REFERENCES public.manuscript_versions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_manuscript_version_id
  ON public.evaluation_jobs(manuscript_version_id);

-- 3) Backfill one initial version for each existing manuscript.
-- NOTE: Canonical manuscript text is currently stored externally (file_url/data URL),
-- so raw_text is initialized as empty string and can be hydrated by application backfill.
INSERT INTO public.manuscript_versions (
  manuscript_id,
  version_number,
  source_version_id,
  raw_text,
  word_count,
  created_by,
  created_at
)
SELECT
  m.id,
  1,
  NULL,
  '',
  COALESCE(m.word_count, 0),
  m.created_by,
  COALESCE(m.created_at, now())
FROM public.manuscripts m
WHERE NOT EXISTS (
  SELECT 1
  FROM public.manuscript_versions mv
  WHERE mv.manuscript_id = m.id
    AND mv.version_number = 1
);

-- 4) Backfill existing jobs to v1 where possible
UPDATE public.evaluation_jobs ej
SET manuscript_version_id = mv.id
FROM public.manuscript_versions mv
WHERE ej.manuscript_id = mv.manuscript_id
  AND mv.version_number = 1
  AND ej.manuscript_version_id IS NULL;

COMMIT;
