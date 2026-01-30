-- Drop duplicate indexes created by scale hardening migration
-- Date: 2026-01-30
-- Purpose: Remove redundant indexes (keep idx_ prefixed canonical versions)

-- These are functionally identical to existing idx_ prefixed indexes:
--   manuscript_chunks_manuscript_idx      = idx_manuscript_chunks_manuscript_id
--   manuscript_chunks_manuscript_job_idx  = idx_manuscript_chunks_manuscript_job
--   manuscript_chunks_processing_lease_idx = idx_manuscript_chunks_recovery

DROP INDEX IF EXISTS public.manuscript_chunks_manuscript_idx;
DROP INDEX IF EXISTS public.manuscript_chunks_manuscript_job_idx;
DROP INDEX IF EXISTS public.manuscript_chunks_processing_lease_idx;

-- Verify we dropped the duplicates (should have 10 total: 9 regular + 1 unique constraint)
DO $$
DECLARE
  index_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  -- Count all indexes
  SELECT COUNT(DISTINCT indexname)
  INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'manuscript_chunks';
  
  -- Count duplicates that should be gone
  SELECT COUNT(*)
  INTO duplicate_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'manuscript_chunks'
    AND indexname IN (
      'manuscript_chunks_manuscript_idx',
      'manuscript_chunks_manuscript_job_idx',
      'manuscript_chunks_processing_lease_idx'
    );
  
  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'Duplicate indexes still exist: %', duplicate_count;
  END IF;
  
  IF index_count <> 10 THEN
    RAISE WARNING 'Expected 10 indexes after cleanup, found %. This may be OK if schema evolved.', index_count;
  END IF;
END $$;
