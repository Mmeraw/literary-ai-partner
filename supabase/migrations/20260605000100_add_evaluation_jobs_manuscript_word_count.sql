-- Add the cached manuscript word count expected by the evaluation worker watchdog.
-- The canonical intake details remain in progress JSONB; this nullable cache keeps
-- hard-stop scans fast and prevents production selects from failing when the
-- worker includes manuscript_word_count in its queue query.

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS manuscript_word_count INTEGER;

UPDATE public.evaluation_jobs
SET manuscript_word_count = NULLIF(progress ->> 'manuscript_word_count', '')::INTEGER
WHERE manuscript_word_count IS NULL
  AND progress ? 'manuscript_word_count'
  AND (progress ->> 'manuscript_word_count') ~ '^[0-9]+$';

UPDATE public.evaluation_jobs
SET manuscript_word_count = NULLIF(progress #>> '{chunk_routing,manuscript_words}', '')::INTEGER
WHERE manuscript_word_count IS NULL
  AND progress #>> '{chunk_routing,manuscript_words}' IS NOT NULL
  AND (progress #>> '{chunk_routing,manuscript_words}') ~ '^[0-9]+$';

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_manuscript_word_count
  ON public.evaluation_jobs (manuscript_word_count);

CREATE OR REPLACE FUNCTION public.sync_evaluation_jobs_manuscript_word_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.progress ? 'manuscript_word_count'
    AND (NEW.progress ->> 'manuscript_word_count') ~ '^[0-9]+$' THEN
    NEW.manuscript_word_count := NULLIF(NEW.progress ->> 'manuscript_word_count', '')::INTEGER;
  ELSIF NEW.progress #>> '{chunk_routing,manuscript_words}' IS NOT NULL
    AND (NEW.progress #>> '{chunk_routing,manuscript_words}') ~ '^[0-9]+$' THEN
    NEW.manuscript_word_count := NULLIF(NEW.progress #>> '{chunk_routing,manuscript_words}', '')::INTEGER;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_evaluation_jobs_manuscript_word_count ON public.evaluation_jobs;

CREATE TRIGGER trg_sync_evaluation_jobs_manuscript_word_count
BEFORE INSERT OR UPDATE OF progress, manuscript_word_count
ON public.evaluation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_evaluation_jobs_manuscript_word_count();

COMMENT ON COLUMN public.evaluation_jobs.manuscript_word_count IS
  'Cached manuscript word count used by evaluation worker SLA and hard-stop scans. Canonical intake detail also remains in progress JSONB.';
