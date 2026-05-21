-- Full-novel staged beta foundation
-- Additive-only workflow substrate for Story Ledger -> Evaluation -> WAVE -> Final Report.

create table if not exists public.evaluation_projects (
  id uuid primary key default gen_random_uuid(),
  manuscript_id bigint not null references public.manuscripts(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'queued' check (
    status in ('draft','queued','running','waiting_for_user','complete','failed','cancelled')
  ),
  current_stage_key text,
  manuscript_version_hash text not null,
  progress_percent numeric not null default 0,
  requires_operator_attention boolean not null default false,
  stalled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_evaluation_projects_user_id on public.evaluation_projects(user_id);
create index if not exists idx_evaluation_projects_manuscript_id on public.evaluation_projects(manuscript_id);
create index if not exists idx_evaluation_projects_status on public.evaluation_projects(status);

create table if not exists public.evaluation_stage_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.evaluation_projects(id) on delete cascade,
  stage_key text not null check (
    stage_key in ('ledger','criteria_pack','consensus','wave_revision_guide','trustedpath_apply','final_report')
  ),
  stage_partition_key text not null default 'default',
  status text not null default 'not_started' check (
    status in ('not_started','blocked','queued','running','complete','waiting_for_user','failed_retryable','failed_terminal','skipped')
  ),
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  input_artifact_ids jsonb not null default '[]'::jsonb,
  output_artifact_ids jsonb not null default '[]'::jsonb,
  checkpoint jsonb not null default '{}'::jsonb,
  confidence_score numeric,
  evidence_density numeric,
  disagreement_score numeric,
  review_recommendation text check (
    review_recommendation in ('auto_advance','user_review_recommended','user_review_required','operator_review_required')
  ),
  idempotency_key text not null,
  failure_code text,
  last_error text,
  last_heartbeat_at timestamptz,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(project_id, stage_key, stage_partition_key, idempotency_key)
);

create index if not exists idx_evaluation_stage_runs_project_id on public.evaluation_stage_runs(project_id);
create index if not exists idx_evaluation_stage_runs_status on public.evaluation_stage_runs(status);
create index if not exists idx_evaluation_stage_runs_stage_key on public.evaluation_stage_runs(stage_key);

create table if not exists public.evaluation_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.evaluation_projects(id) on delete cascade,
  stage_run_id uuid references public.evaluation_stage_runs(id) on delete set null,
  event_type text not null check (
    event_type in (
      'project_created',
      'stage_started',
      'artifact_written',
      'stage_completed',
      'stage_failed',
      'stage_retried',
      'stage_approved',
      'ledger_approved'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_evaluation_events_project_id on public.evaluation_events(project_id);
create index if not exists idx_evaluation_events_stage_run_id on public.evaluation_events(stage_run_id);
create index if not exists idx_evaluation_events_event_type on public.evaluation_events(event_type);

-- Lightweight bridge from legacy evaluation_jobs to staged project wrapper.
-- Nullable and additive so existing jobs keep running without migration-time backfill.
alter table public.evaluation_jobs
  add column if not exists evaluation_project_id uuid references public.evaluation_projects(id) on delete set null,
  add column if not exists ledger_approved_at timestamptz,
  add column if not exists ledger_approved_by uuid,
  add column if not exists guided_full_novel_stage text;

create index if not exists idx_evaluation_jobs_evaluation_project_id on public.evaluation_jobs(evaluation_project_id);
create index if not exists idx_evaluation_jobs_guided_full_novel_stage on public.evaluation_jobs(guided_full_novel_stage);
