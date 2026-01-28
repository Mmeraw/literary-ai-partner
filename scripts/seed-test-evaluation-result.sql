-- Seed one test evaluation_result for /reports/[jobId] verification
-- Run this in Supabase SQL Editor AFTER applying the migration

-- First, get an existing job ID or create a test job
DO $$
DECLARE
  test_job_id UUID;
  test_manuscript_id UUID;
BEGIN
  -- Try to find an existing job
  SELECT id, manuscript_id INTO test_job_id, test_manuscript_id
  FROM public.evaluation_jobs
  LIMIT 1;
  
  -- If no jobs exist, create a test job
  IF test_job_id IS NULL THEN
    -- Create test manuscript first
    INSERT INTO public.manuscripts (title, author, content, word_count)
    VALUES ('Test Manuscript', 'Test Author', 'Test content for evaluation testing.', 6)
    RETURNING id INTO test_manuscript_id;
    
    -- Create test evaluation job
    -- Required NOT NULL fields: policy_family, voice_preservation_level, english_variant
    -- Allowed values: policy_family IN ('standard','dark_fiction','trauma_memoir')
    --                 voice_preservation_level IN ('strict','balanced','expressive')
    --                 english_variant IN ('us','uk','ca','au')
    INSERT INTO public.evaluation_jobs (
      manuscript_id, 
      status,
      job_type,
      phase,
      policy_family,
      voice_preservation_level,
      english_variant
    )
    VALUES (
      test_manuscript_id, 
      'completed',
      'full_evaluation',
      'phase_1',
      'standard',
      'balanced',
      'us'
    )
    RETURNING id INTO test_job_id;
    
    RAISE NOTICE 'Created test job: %', test_job_id;
  ELSE
    RAISE NOTICE 'Using existing job: %', test_job_id;
  END IF;
  
  -- Insert a valid EvaluationResultV1 payload
  UPDATE public.evaluation_jobs
  SET 
    evaluation_result = jsonb_build_object(
      'schema_version', 'evaluation_result_v1',
      'evaluation_run_id', gen_random_uuid()::text,
      'job_id', test_job_id::text,
      'manuscript_id', test_manuscript_id::text,
      'timestamp', now()::text,
      'overview', jsonb_build_object(
        'verdict', 'promising',
        'overall_score', 7.2,
        'summary', 'This test evaluation demonstrates a complete EvaluationResultV1 payload with all required fields. The manuscript shows solid fundamentals with room for strategic revision.',
        'key_strengths', ARRAY[
          'Clear schema structure',
          'Complete validation coverage',
          'Production-ready payload format'
        ],
        'critical_risks', ARRAY[
          'Test data only - replace with real evaluation',
          'Scores are placeholder values'
        ]
      ),
      'criteria', jsonb_build_object(
        'concept', jsonb_build_object('score', 7, 'rationale', 'Solid core concept with clear purpose'),
        'premise', jsonb_build_object('score', 7, 'rationale', 'Engaging premise that hooks reader interest'),
        'stakes', jsonb_build_object('score', 6, 'rationale', 'Stakes are present but could be heightened'),
        'protagonist', jsonb_build_object('score', 8, 'rationale', 'Well-defined protagonist with clear motivation'),
        'voice', jsonb_build_object('score', 7, 'rationale', 'Distinctive voice that serves the story'),
        'structure', jsonb_build_object('score', 6, 'rationale', 'Structure is functional but could be more dynamic'),
        'pacing', jsonb_build_object('score', 7, 'rationale', 'Generally good pacing with some slow sections'),
        'dialogue', jsonb_build_object('score', 8, 'rationale', 'Natural dialogue that reveals character'),
        'setting', jsonb_build_object('score', 7, 'rationale', 'Vivid setting details ground the story'),
        'theme', jsonb_build_object('score', 6, 'rationale', 'Theme is present but could be explored more deeply'),
        'originality', jsonb_build_object('score', 7, 'rationale', 'Fresh take on familiar elements'),
        'emotional_impact', jsonb_build_object('score', 7, 'rationale', 'Story resonates emotionally with reader'),
        'craft', jsonb_build_object('score', 8, 'rationale', 'Strong technical execution throughout')
      ),
      'recommendations', jsonb_build_object(
        'quick_wins', jsonb_build_array(
          jsonb_build_object(
            'title', 'Heighten stakes in opening chapter',
            'impact', 'high',
            'effort', 'low',
            'rationale', 'Small changes to opening can dramatically increase reader engagement'
          ),
          jsonb_build_object(
            'title', 'Trim slow middle section',
            'impact', 'medium',
            'effort', 'low',
            'rationale', 'Pacing improvements will keep readers engaged'
          )
        ),
        'strategic_revisions', jsonb_build_array(
          jsonb_build_object(
            'title', 'Deepen thematic exploration',
            'impact', 'high',
            'effort', 'medium',
            'rationale', 'More explicit theme work will elevate the entire manuscript'
          ),
          jsonb_build_object(
            'title', 'Restructure middle act',
            'impact', 'high',
            'effort', 'high',
            'rationale', 'Structural changes will create more dynamic narrative momentum'
          )
        )
      ),
      'artifacts', jsonb_build_array(
        jsonb_build_object(
          'type', 'synopsis',
          'status', 'generated',
          'location', 'artifacts/synopsis.md',
          'description', 'One-page synopsis for agent queries'
        ),
        jsonb_build_object(
          'type', 'comps',
          'status', 'generated',
          'location', 'artifacts/comps.md',
          'description', 'Comparable titles analysis'
        )
      ),
      'metadata', jsonb_build_object(
        'engine_model', 'test-model-v1',
        'engine_version', '1.0.0',
        'confidence_score', 0.85,
        'manuscript_word_count', 75000,
        'processing_time_seconds', 42,
        'warnings', ARRAY['This is test data for verification purposes']
      )
    ),
    evaluation_result_version = 'evaluation_result_v1',
    status = 'completed',
    updated_at = now()
  WHERE id = test_job_id;
  
  RAISE NOTICE 'Seeded evaluation_result for job: %', test_job_id;
  RAISE NOTICE 'Test URL: /reports/%', test_job_id;
END $$;

-- Verify the data was inserted
SELECT 
  id,
  manuscript_id,
  status,
  evaluation_result_version,
  evaluation_result->>'schema_version' as schema_version,
  evaluation_result->'overview'->>'verdict' as verdict,
  evaluation_result->'overview'->>'overall_score' as overall_score,
  '/reports/' || id::text as test_url
FROM public.evaluation_jobs
WHERE evaluation_result IS NOT NULL
ORDER BY updated_at DESC
LIMIT 1;
