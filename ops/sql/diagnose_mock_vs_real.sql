-- Mock vs Real Evaluation Diagnostic Query
-- Run this in Supabase SQL Editor to check if an evaluation used real AI or mock fallback

-- ========================================
-- QUICK CHECK: Is a specific job mock or real?
-- ========================================
-- Replace 'YOUR_JOB_ID' with your actual job ID

SELECT
  job_id,
  artifact_type,
  created_at,
  content->'governance'->'warnings' AS warnings,
  content->'engine'->>'model' AS model,
  content->'engine'->>'provider' AS provider,
  content->'governance'->>'confidence' AS confidence,
  content->'overview'->>'overall_score_0_100' AS overall_score
FROM public.evaluation_artifacts
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 1;

-- ========================================
-- INTERPRETATION GUIDE
-- ========================================
/*
MOCK EVALUATION (not real AI):
- warnings contains: "MOCK EVALUATION"
- confidence = 0.85 (hardcoded)
- overall_score = 72 (hardcoded)
- model may be missing or null

REAL AI EVALUATION:
- warnings is null or empty array []
- confidence = 0.90 (default)
- model is "gpt-4o-mini"
- provider is "openai"
- overall_score varies based on actual analysis
*/

-- ========================================
-- CHECK ALL RECENT EVALUATIONS
-- ========================================
-- See which of your recent evaluations were mock vs real

SELECT
  job_id,
  created_at,
  CASE 
    WHEN content->'governance'->'warnings' IS NOT NULL 
         AND content->'governance'->'warnings' != '[]'::jsonb
    THEN 'MOCK' 
    ELSE 'REAL' 
  END AS evaluation_type,
  content->'engine'->>'model' AS model,
  content->'governance'->>'confidence' AS confidence,
  content->'overview'->>'overall_score_0_100' AS score
FROM public.evaluation_artifacts
WHERE artifact_type = 'one_page_summary'
ORDER BY created_at DESC
LIMIT 20;

-- ========================================
-- FIND ALL MOCK EVALUATIONS (Cleanup Query)
-- ========================================
-- Use this to find all mock evaluations that need to be re-run with real AI

SELECT
  ea.job_id,
  ea.created_at,
  ej.status AS job_status,
  ea.content->'governance'->'warnings' AS warnings
FROM public.evaluation_artifacts ea
LEFT JOIN public.evaluation_jobs ej ON ej.id = ea.job_id
WHERE 
  ea.artifact_type = 'one_page_summary'
  AND ea.content->'governance'->'warnings' IS NOT NULL
  AND ea.content->'governance'->'warnings' != '[]'::jsonb
ORDER BY ea.created_at DESC;

-- ========================================
-- CHECK OPENAI CALL SUCCESS RATE
-- ========================================
-- Shows the ratio of real AI vs mock evaluations over time

SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_evaluations,
  COUNT(*) FILTER (
    WHERE content->'governance'->'warnings' IS NULL 
       OR content->'governance'->'warnings' = '[]'::jsonb
  ) AS real_ai_count,
  COUNT(*) FILTER (
    WHERE content->'governance'->'warnings' IS NOT NULL 
      AND content->'governance'->'warnings' != '[]'::jsonb
  ) AS mock_count,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE content->'governance'->'warnings' IS NULL 
         OR content->'governance'->'warnings' = '[]'::jsonb
    ) / NULLIF(COUNT(*), 0),
    1
  ) AS real_ai_percentage
FROM public.evaluation_artifacts
WHERE artifact_type = 'one_page_summary'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
