begin;

create table if not exists public.revision_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  revision_session_id uuid null references public.revision_sessions(id) on delete cascade,
  proposal_id uuid null references public.change_proposals(id) on delete cascade,
  manuscript_id bigint null references public.manuscripts(id) on delete set null,
  manuscript_version_id uuid null references public.manuscript_versions(id) on delete set null,
  evaluation_run_id uuid null references public.evaluation_jobs(id) on delete set null,

  event_type text not null,
  severity text not null default 'info',
  event_code text not null,
  message text null,

  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_revision_events_created_at
  on public.revision_events(created_at);

create index if not exists idx_revision_events_event_type
  on public.revision_events(event_type);

create index if not exists idx_revision_events_event_code
  on public.revision_events(event_code);

create index if not exists idx_revision_events_revision_session_id
  on public.revision_events(revision_session_id);

create index if not exists idx_revision_events_proposal_id
  on public.revision_events(proposal_id);

create index if not exists idx_revision_events_evaluation_run_id
  on public.revision_events(evaluation_run_id);

comment on table public.revision_events is
  'Non-blocking Stage 2 revision telemetry for proposal generation, anchored apply, finalize outcomes, immutability checks, and smoke harness behavior.';

commit;
