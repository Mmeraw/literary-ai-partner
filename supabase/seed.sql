insert into public.evaluation_jobs (
  manuscript_id,
  job_type,
  status,
  phase,
  work_type,
  policy_family,
  voice_preservation_level,
  english_variant
) values (
  1,
  'full_evaluation',
  'queued',
  'phase_1',
  'novel',
  'standard',
  'balanced',
  'us'
) on conflict do nothing;
