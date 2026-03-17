begin;

alter table public.revision_sessions
  add column if not exists findings_count integer not null default 0;

alter table public.revision_sessions
  add column if not exists actionable_findings_count integer not null default 0;

alter table public.revision_sessions
  add column if not exists proposal_ready_actionable_findings_count integer not null default 0;

alter table public.revision_sessions
  add column if not exists proposals_created_count integer not null default 0;

alter table public.revision_sessions
  add column if not exists last_transition_at timestamptz null;

alter table public.revision_sessions
  add column if not exists failure_code text null;

alter table public.revision_sessions
  add column if not exists failure_message text null;

update public.revision_sessions
set
  status = 'failed',
  failure_code = coalesce(nullif(failure_code, ''), 'LEGACY_DISCARDED_SESSION'),
  failure_message = coalesce(
    nullif(failure_message, ''),
    'Backfilled from legacy discarded revision session during Stage 3 lifecycle migration.'
  ),
  completed_at = coalesce(completed_at, now())
where status = 'discarded';

alter table public.revision_sessions
  drop constraint if exists revision_sessions_status_check;

alter table public.revision_sessions
  add constraint revision_sessions_status_check
  check (
    status in (
      'open',
      'findings_ready',
      'synthesis_started',
      'proposals_ready',
      'applied',
      'failed'
    )
  );

update public.revision_sessions
set
  findings_count = coalesce(findings_count, 0),
  actionable_findings_count = coalesce(actionable_findings_count, 0),
  proposal_ready_actionable_findings_count = coalesce(proposal_ready_actionable_findings_count, 0),
  proposals_created_count = coalesce(proposals_created_count, 0),
  last_transition_at = coalesce(last_transition_at, completed_at, created_at),
  failure_code = case when status = 'failed' then coalesce(nullif(failure_code, ''), 'REVISION_SESSION_FAILED') else null end,
  failure_message = case when status = 'failed' then coalesce(nullif(failure_message, ''), 'Revision session entered failed state during Stage 3 backfill.') else null end;

comment on column public.revision_sessions.findings_count is
  'Count of normalized diagnostic findings persisted for this revision session.';

comment on column public.revision_sessions.actionable_findings_count is
  'Count of actionable diagnostic findings before proposal-readiness filtering.';

comment on column public.revision_sessions.proposal_ready_actionable_findings_count is
  'Count of actionable findings with enough source anchoring/input quality to synthesize proposals.';

comment on column public.revision_sessions.proposals_created_count is
  'Count of change proposals created for the revision session.';

comment on column public.revision_sessions.last_transition_at is
  'Timestamp of the most recent valid persisted revision session lifecycle transition.';

comment on column public.revision_sessions.failure_code is
  'Machine-readable failure code for terminal failed revision sessions.';

comment on column public.revision_sessions.failure_message is
  'Operator-facing failure detail for terminal failed revision sessions.';

commit;
