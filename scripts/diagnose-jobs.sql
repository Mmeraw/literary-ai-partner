-- Diagnostic queries to understand why worker processes 0 jobs
-- Run these in Supabase SQL Editor

-- 1. Overall status distribution
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as newest
FROM public.evaluation_jobs
GROUP BY status
ORDER BY count DESC;

-- 2. All queued jobs (should be claimable)
SELECT 
  id,
  status,
  progress->>'phase' as phase,
  progress->>'phase_status' as phase_status,
  progress->>'lease_id' as lease_id,
  progress->>'lease_expires_at' as lease_expires_at,
  created_at,
  updated_at
FROM public.evaluation_jobs
WHERE status = 'queued'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Running jobs (check if leases are expired)
SELECT 
  id,
  status,
  progress->>'phase' as phase,
  progress->>'lease_id' as lease_id,
  progress->>'lease_expires_at' as lease_expires_at,
  (progress->>'lease_expires_at')::timestamptz as expires_at_parsed,
  now() as current_time,
  CASE 
    WHEN (progress->>'lease_expires_at')::timestamptz <= now() THEN 'EXPIRED'
    ELSE 'LIVE'
  END as lease_status,
  created_at
FROM public.evaluation_jobs
WHERE status = 'running'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Phase 1 jobs only (what claim_evaluation_job_phase1 should process)
SELECT 
  id,
  status,
  progress->>'phase' as phase,
  progress->>'phase_status' as phase_status,
  COALESCE(progress->>'phase','') as phase_coalesced
FROM public.evaluation_jobs
WHERE COALESCE(progress->>'phase','') = 'phase_1'
ORDER BY created_at DESC
LIMIT 20;

-- 5. Jobs that match claim_evaluation_job_phase1 WHERE clause
-- (queued OR (running AND phase_1 AND lease_expired))
SELECT 
  id,
  status,
  progress->>'phase' as phase,
  progress->>'lease_expires_at' as lease_expires_at,
  CASE 
    WHEN status = 'queued' THEN 'eligible'
    WHEN status = 'running' 
      AND COALESCE(progress->>'phase','') = 'phase_1'
      AND COALESCE(progress->>'lease_expires_at','') <> ''
      AND (progress->>'lease_expires_at')::timestamptz <= now() THEN 'eligible (recovery)'
    ELSE 'not eligible'
  END as claimability,
  created_at
FROM public.evaluation_jobs
ORDER BY created_at DESC
LIMIT 30;
