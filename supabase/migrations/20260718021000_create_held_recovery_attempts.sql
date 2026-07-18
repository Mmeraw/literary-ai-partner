begin;

create table if not exists public.held_recovery_attempts (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  held_item_id text not null,
  opportunity_id text not null,
  manuscript_id bigint not null references public.manuscripts(id) on delete cascade,
  manuscript_version_sha text not null,
  held_item_persisted_version text not null,

  runtime_outcome_status text not null check (runtime_outcome_status in ('completed', 'deferred', 'unchanged', 'rejected')),
  runtime_rejection_reason text null,
  executor_result jsonb not null,

  series_key jsonb not null,
  recovery_input_fingerprint text not null,
  attempt_number integer not null check (attempt_number >= 1),
  max_attempts integer not null check (max_attempts >= 1),
  status text not null check (status in (
    'held',
    'recovery_attempt_pending',
    'recovery_attempt_running',
    'recovery_attempt_failed_retryable',
    'recovery_attempt_failed_terminal',
    'recovered_pending_reclassification',
    'reclassified',
    'dismissed'
  )),
  outcome text not null check (outcome in ('pending', 'succeeded', 'failed_retryable', 'failed_terminal', 'dismissed')),
  terminal_card_type text null check (terminal_card_type is null or terminal_card_type in ('copy_paste_rewrite', 'revision_strategy', 'withheld')),
  terminal_trusted_path_status text null check (terminal_trusted_path_status is null or terminal_trusted_path_status in ('eligible', 'unavailable_author_review_required', 'impossible')),
  snapshot jsonb not null,
  events jsonb not null default '[]'::jsonb,

  constraint held_recovery_attempts_events_array check (jsonb_typeof(events) = 'array'),
  constraint held_recovery_attempts_snapshot_object check (jsonb_typeof(snapshot) = 'object'),
  constraint held_recovery_attempts_series_key_object check (jsonb_typeof(series_key) = 'object'),
  constraint held_recovery_attempts_executor_result_object check (jsonb_typeof(executor_result) = 'object')
);

alter table public.held_recovery_attempts enable row level security;

drop policy if exists "Service role: full access" on public.held_recovery_attempts;
create policy "Service role: full access"
  on public.held_recovery_attempts
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_held_recovery_attempts_opportunity_id
  on public.held_recovery_attempts(opportunity_id);

create index if not exists idx_held_recovery_attempts_held_item_id
  on public.held_recovery_attempts(held_item_id);

create index if not exists idx_held_recovery_attempts_manuscript_id
  on public.held_recovery_attempts(manuscript_id);

create index if not exists idx_held_recovery_attempts_created_at
  on public.held_recovery_attempts(created_at);

create index if not exists idx_held_recovery_attempts_series_key
  on public.held_recovery_attempts using gin(series_key);

comment on table public.held_recovery_attempts is
  'Durable audit records for bounded Held Recovery runtime attempts. This table records attempts only; it does not drive queue transitions, retry scheduling, ledger mutation, candidate persistence, manuscript mutation, or Final Review mutation.';

commit;