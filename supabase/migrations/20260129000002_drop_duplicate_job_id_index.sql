-- Drop duplicate job_id index (keeping partial index for better performance)
--
-- Background:
--   We have two indexes on manuscript_chunks.job_id:
--     1. idx_manuscript_chunks_job_id (partial: WHERE job_id IS NOT NULL)
--     2. manuscript_chunks_job_id_idx (full: no WHERE clause)
--
--   The partial index is more efficient because:
--     - job_id is nullable (NULL during initial upload, set later)
--     - Partial index is smaller (only indexes non-NULL rows)
--     - All queries filter WHERE job_id IS NOT NULL anyway
--     - At 10M rows, duplicate indexes = extra write cost + bloat
--
--   Keeping: idx_manuscript_chunks_job_id (partial, created earlier)
--   Dropping: manuscript_chunks_job_id_idx (redundant full index)

DROP INDEX IF EXISTS public.manuscript_chunks_job_id_idx;

-- Verify we still have the partial index
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'manuscript_chunks'
      AND indexname = 'idx_manuscript_chunks_job_id'
  ) THEN
    RAISE EXCEPTION 'Critical: idx_manuscript_chunks_job_id (partial index) is missing!';
  END IF;
END $$;
