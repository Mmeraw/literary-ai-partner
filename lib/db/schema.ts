// lib/db/schema.ts
// Canonical Supabase schema — Phase 0 lock

export type AccessLogRow = {
  id: number;
  user_id: string | null;
  action: string | null;
  resource: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type AnalyticsRow = {
  id: number;
  user_id: string | null;
  event_type: string | null;
  event_data: Record<string, unknown> | null;
  created_at: string | null;
};

export type EvaluationJobRow = {
  id: string;
  manuscript_id: number;
  job_type: string;
  status: string;
  progress: Record<string, unknown> | null;
  total_units: number | null;
  completed_units: number | null;
  failed_units: number | null;
  retry_count: number | null;
  next_retry_at: string | null;
  last_error: string | null;
  failure_envelope: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  last_heartbeat: string | null;
  phase: string;
  work_type: string | null;
  policy_family: string;
  voice_preservation_level: string;
  english_variant: string;
  phase_1_status: string | null;
  phase_1_locked_at: string | null;
  phase_1_locked_by: string | null;
  phase_1_started_at: string | null;
  phase_1_completed_at: string | null;
  phase_1_attempt_count: number | null;
  phase_1_error: string | null;
};

export type EvaluationRow = {
  id: number;
  manuscript_id: number | null;
  user_id: string;
  evaluation_data: Record<string, unknown> | null;
  score: number | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ManuscriptRow = {
  id: number;
  created_at: string;
  user_id: string | null;
  title: string;
  file_url: string | null;
  file_size: number | null;
  work_type: string | null;
  status: string | null;
  updated_at: string | null;
  tone_context: string;
  mood_context: string;
  voice_mode: string;
  default_register_lock: string | null;
  created_by: string | null;
  storygate_linked: boolean;
  allow_industry_discovery: boolean;
  is_final: boolean;
  source: string;
  english_variant: string;
  word_count: number;
};

export type StoryCriterionRow = {
  id: number;
  criterion_name: string;
  description: string | null;
  weight: number | null;
  category: string | null;
  created_at: string | null;
  updated_at: string | null;
};
