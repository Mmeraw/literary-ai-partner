-- Scale Hardening Migration: Indexes for 100k+ users
-- Date: 2026-01-29
-- Purpose: Add critical missing indexes for 10M+ chunk scale

-- ════════════════════════════════════════════════════════════════
-- 1. job_id index for Phase 2 queries
-- ════════════════════════════════════════════════════════════════
-- Phase 2 queries filter by job_id to avoid aggregating stale chunks
-- Without this index: O(10M) scan = 10+ seconds
-- With this index: O(100) lookup = <100ms

CREATE INDEX IF NOT EXISTS manuscript_chunks_job_id_idx
  ON public.manuscript_chunks (job_id)
  WHERE job_id IS NOT NULL;

COMMENT ON INDEX public.manuscript_chunks_job_id_idx IS
  'Critical for Phase 2 queries. Filters 10M chunks → ~100 chunks per job.';

-- ════════════════════════════════════════════════════════════════
-- 2. Crash recovery index for expired leases
-- ════════════════════════════════════════════════════════════════
-- Crash recovery scans for chunks with expired leases to reclaim
-- Without this index: O(10M) scan = 10+ seconds
-- With this index: O(10) lookup = <50ms

CREATE INDEX IF NOT EXISTS manuscript_chunks_processing_lease_idx
  ON public.manuscript_chunks (lease_expires_at, status)
  WHERE status = 'processing';

COMMENT ON INDEX public.manuscript_chunks_processing_lease_idx IS
  'Critical for crash recovery. Finds expired leases in O(log N) time.';

-- ════════════════════════════════════════════════════════════════
-- 3. Composite index for Phase 2 manuscript+job queries
-- ════════════════════════════════════════════════════════════════
-- Phase 2 queries filter by BOTH manuscript_id AND job_id
-- This composite index covers both conditions efficiently

CREATE INDEX IF NOT EXISTS manuscript_chunks_manuscript_job_idx
  ON public.manuscript_chunks (manuscript_id, job_id)
  WHERE job_id IS NOT NULL;

COMMENT ON INDEX public.manuscript_chunks_manuscript_job_idx IS
  'Composite index for Phase 2: manuscript_id + job_id lookups.';

-- ════════════════════════════════════════════════════════════════
-- 4. Status+updated_at index for monitoring/cleanup
-- ════════════════════════════════════════════════════════════════
-- Admin queries to find stuck/failed chunks use this pattern
-- Helps identify chunks that need manual intervention

CREATE INDEX IF NOT EXISTS manuscript_chunks_status_updated_idx
  ON public.manuscript_chunks (status, updated_at DESC);

COMMENT ON INDEX public.manuscript_chunks_status_updated_idx IS
  'Helps find recently failed/stuck chunks for monitoring dashboards.';

-- ════════════════════════════════════════════════════════════════
-- Performance Verification Query
-- ════════════════════════════════════════════════════════════════
-- Run this to verify indexes are being used:
--
-- EXPLAIN ANALYZE
-- SELECT * FROM manuscript_chunks
-- WHERE job_id = '...'::uuid
-- ORDER BY chunk_index ASC;
--
-- Should show: "Index Scan using manuscript_chunks_job_id_idx"
-- ════════════════════════════════════════════════════════════════
