begin;

create table if not exists public.held_recovery_retry_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_idempotency_key text not null unique,
  held_item_id text not null,
  attempt_id text not null,
  transition_event_id text not null,
  retry_at timestamptz not null,
  decision_reason text not null check (decision_reason in ('retryable_failure_window_open')),
  policy_version text not null,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.held_recovery_retry_schedules enable row level security;

drop policy if exists "Service role: full access" on public.held_recovery_retry_schedules;
create policy "Service role: full access"
  on public.held_recovery_retry_schedules
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_held_recovery_retry_schedules_held_item_id
  on public.held_recovery_retry_schedules(held_item_id);

create index if not exists idx_held_recovery_retry_schedules_retry_at
  on public.held_recovery_retry_schedules(retry_at);

create or replace function public.apply_held_recovery_retry_schedule_atomic(
  p_schedule jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_idempotency_key text;
  v_held_item_id text;
  v_attempt_id text;
  v_transition_event_id text;
  v_retry_at timestamptz;
  v_decision_reason text;
  v_policy_version text;
  v_scheduled_at timestamptz;
  v_latest_attempt_id text;
  v_latest_transition_event_id text;
  v_existing public.held_recovery_retry_schedules%rowtype;
begin
  if p_schedule is null or jsonb_typeof(p_schedule) <> 'object' then
    raise exception 'Held Recovery retry schedule blocked: p_schedule must be a JSON object';
  end if;

  v_schedule_idempotency_key := nullif(btrim(p_schedule ->> 'schedule_idempotency_key'), '');
  v_held_item_id := nullif(btrim(p_schedule ->> 'held_item_id'), '');
  v_attempt_id := nullif(btrim(p_schedule ->> 'attempt_id'), '');
  v_transition_event_id := nullif(btrim(p_schedule ->> 'transition_event_id'), '');
  v_retry_at := (p_schedule ->> 'retry_at')::timestamptz;
  v_decision_reason := nullif(btrim(p_schedule ->> 'decision_reason'), '');
  v_policy_version := nullif(btrim(p_schedule ->> 'policy_version'), '');
  v_scheduled_at := coalesce((p_schedule ->> 'scheduled_at')::timestamptz, now());

  if v_schedule_idempotency_key is null
     or v_held_item_id is null
     or v_attempt_id is null
     or v_transition_event_id is null
     or v_retry_at is null
     or v_decision_reason is null
     or v_policy_version is null then
    raise exception 'Held Recovery retry schedule blocked: required schedule fields are missing';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_held_item_id),
    hashtext(v_schedule_idempotency_key)
  );

  select a.id::text
  into v_latest_attempt_id
  from public.held_recovery_attempts a
  where a.held_item_id = v_held_item_id
  order by a.attempt_number desc, a.created_at desc, a.id desc
  limit 1;

  select e.id::text
  into v_latest_transition_event_id
  from public.held_recovery_queue_transition_events e
  where e.held_item_id = v_held_item_id
  order by e.applied_at desc, e.created_at desc, e.id desc
  limit 1;

  if v_latest_attempt_id is distinct from v_attempt_id
     or v_latest_transition_event_id is distinct from v_transition_event_id then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'reason', 'superseded_by_later_attempt_or_transition'
    );
  end if;

  select *
  into v_existing
  from public.held_recovery_retry_schedules s
  where s.schedule_idempotency_key = v_schedule_idempotency_key;

  if found then
    if v_existing.held_item_id is distinct from v_held_item_id
       or v_existing.attempt_id is distinct from v_attempt_id
       or v_existing.transition_event_id is distinct from v_transition_event_id
       or v_existing.retry_at is distinct from v_retry_at
       or v_existing.decision_reason is distinct from v_decision_reason
       or v_existing.policy_version is distinct from v_policy_version then
      return jsonb_build_object(
        'status', 'persistence_failed',
        'reason', 'idempotency_conflict'
      );
    end if;

    return jsonb_build_object(
      'status', 'already_scheduled',
      'id', v_existing.id,
      'schedule_idempotency_key', v_existing.schedule_idempotency_key,
      'held_item_id', v_existing.held_item_id,
      'attempt_id', v_existing.attempt_id,
      'transition_event_id', v_existing.transition_event_id,
      'retry_at', v_existing.retry_at,
      'decision_reason', v_existing.decision_reason,
      'policy_version', v_existing.policy_version,
      'scheduled_at', v_existing.scheduled_at
    );
  end if;

  insert into public.held_recovery_retry_schedules (
    schedule_idempotency_key,
    held_item_id,
    attempt_id,
    transition_event_id,
    retry_at,
    decision_reason,
    policy_version,
    scheduled_at
  ) values (
    v_schedule_idempotency_key,
    v_held_item_id,
    v_attempt_id,
    v_transition_event_id,
    v_retry_at,
    v_decision_reason,
    v_policy_version,
    v_scheduled_at
  )
  returning * into v_existing;

  return jsonb_build_object(
    'status', 'scheduled',
    'id', v_existing.id,
    'schedule_idempotency_key', v_existing.schedule_idempotency_key,
    'held_item_id', v_existing.held_item_id,
    'attempt_id', v_existing.attempt_id,
    'transition_event_id', v_existing.transition_event_id,
    'retry_at', v_existing.retry_at,
    'decision_reason', v_existing.decision_reason,
    'policy_version', v_existing.policy_version,
    'scheduled_at', v_existing.scheduled_at
  );
end;
$$;

revoke all on function public.apply_held_recovery_retry_schedule_atomic(jsonb) from public;
revoke all on function public.apply_held_recovery_retry_schedule_atomic(jsonb) from authenticated;
revoke all on function public.apply_held_recovery_retry_schedule_atomic(jsonb) from anon;
grant execute on function public.apply_held_recovery_retry_schedule_atomic(jsonb) to service_role;

comment on table public.held_recovery_retry_schedules is
  'Durable Held Recovery retry schedule authority. Stores retry schedule records only and does not execute retries, claim due work, transition queue state, or mutate downstream artifacts.';

comment on function public.apply_held_recovery_retry_schedule_atomic(jsonb) is
  'Atomic compare-and-set writer for Held Recovery retry schedules. Verifies attempt and transition authority are still current and persists one deterministic schedule record.';

commit;