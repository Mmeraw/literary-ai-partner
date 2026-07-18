begin;

alter table public.held_recovery_retry_schedules
  add column if not exists claimed_by text,
  add column if not exists claimed_at timestamptz,
  add column if not exists lease_token uuid,
  add column if not exists lease_until timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.held_recovery_retry_schedules
  drop constraint if exists held_recovery_retry_schedules_lease_fields_consistent;

alter table public.held_recovery_retry_schedules
  add constraint held_recovery_retry_schedules_lease_fields_consistent check (
    (
      claimed_by is null
      and claimed_at is null
      and lease_token is null
      and lease_until is null
    )
    or (
      claimed_by is not null
      and claimed_at is not null
      and lease_token is not null
      and lease_until is not null
    )
  );

create index if not exists idx_held_recovery_retry_schedules_due_uncompleted
  on public.held_recovery_retry_schedules(retry_at, lease_until)
  where completed_at is null;

create or replace function public.claim_held_recovery_retry_schedule_atomic(
  p_claim jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_id uuid;
  v_claimed_by text;
  v_lease_token uuid;
  v_lease_until timestamptz;
  v_claimed_at timestamptz;
  v_latest_attempt_id text;
  v_latest_transition_event_id text;
  v_queue_state text;
  v_schedule public.held_recovery_retry_schedules%rowtype;
begin
  if p_claim is null or jsonb_typeof(p_claim) <> 'object' then
    raise exception 'Held Recovery retry schedule claim blocked: p_claim must be a JSON object';
  end if;

  v_schedule_id := (p_claim ->> 'schedule_id')::uuid;
  v_claimed_by := nullif(btrim(p_claim ->> 'claimed_by'), '');
  v_lease_token := (p_claim ->> 'lease_token')::uuid;
  v_lease_until := (p_claim ->> 'lease_until')::timestamptz;
  v_claimed_at := coalesce((p_claim ->> 'claimed_at')::timestamptz, now());

  if v_schedule_id is null
     or v_claimed_by is null
     or v_lease_token is null
     or v_lease_until is null then
    raise exception 'Held Recovery retry schedule claim blocked: required claim fields are missing';
  end if;

  if v_lease_until <= now() then
    return jsonb_build_object(
      'status', 'persistence_failed',
      'reason', 'invalid_lease_until'
    );
  end if;

  select *
  into v_schedule
  from public.held_recovery_retry_schedules s
  where s.id = v_schedule_id
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'existing_retry_schedule',
      'actual_state', null
    );
  end if;

  if v_schedule.completed_at is not null then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'retry_schedule_open',
      'actual_state', 'completed'
    );
  end if;

  if v_schedule.lease_token is not null and v_schedule.lease_until > now() then
    if v_schedule.claimed_by = v_claimed_by and v_schedule.lease_token = v_lease_token then
      return jsonb_build_object(
        'status', 'already_claimed',
        'id', v_schedule.id,
        'schedule_idempotency_key', v_schedule.schedule_idempotency_key,
        'held_item_id', v_schedule.held_item_id,
        'attempt_id', v_schedule.attempt_id,
        'transition_event_id', v_schedule.transition_event_id,
        'retry_at', v_schedule.retry_at,
        'decision_reason', v_schedule.decision_reason,
        'policy_version', v_schedule.policy_version,
        'scheduled_at', v_schedule.scheduled_at,
        'claimed_by', v_schedule.claimed_by,
        'claimed_at', v_schedule.claimed_at,
        'lease_token', v_schedule.lease_token,
        'lease_until', v_schedule.lease_until,
        'completed_at', v_schedule.completed_at
      );
    end if;

    return jsonb_build_object(
      'status', 'lease_conflict',
      'reason', 'active_lease_owned_by_another_runtime'
    );
  end if;

  if v_schedule.retry_at > now() then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'retry_schedule_due',
      'actual_state', 'retry_at_future'
    );
  end if;

  select a.id::text
  into v_latest_attempt_id
  from public.held_recovery_attempts a
  where a.held_item_id = v_schedule.held_item_id
  order by a.attempt_number desc, a.created_at desc, a.id desc
  limit 1;

  select e.id::text
  into v_latest_transition_event_id
  from public.held_recovery_queue_transition_events e
  where e.held_item_id = v_schedule.held_item_id
  order by e.applied_at desc, e.created_at desc, e.id desc
  limit 1;

  if v_latest_attempt_id is distinct from v_schedule.attempt_id
     or v_latest_transition_event_id is distinct from v_schedule.transition_event_id then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'reason', 'superseded_by_later_attempt_or_transition'
    );
  end if;

  select q.queue_state
  into v_queue_state
  from public.held_recovery_queue_items q
  where q.held_item_id = v_schedule.held_item_id
  for update;

  if v_queue_state is distinct from 'recovery_attempt_failed_retryable' then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'recovery_attempt_failed_retryable',
      'actual_state', v_queue_state
    );
  end if;

  update public.held_recovery_retry_schedules
  set claimed_by = v_claimed_by,
      claimed_at = v_claimed_at,
      lease_token = v_lease_token,
      lease_until = v_lease_until,
      updated_at = now()
  where id = v_schedule_id
  returning * into v_schedule;

  return jsonb_build_object(
    'status', 'claimed',
    'id', v_schedule.id,
    'schedule_idempotency_key', v_schedule.schedule_idempotency_key,
    'held_item_id', v_schedule.held_item_id,
    'attempt_id', v_schedule.attempt_id,
    'transition_event_id', v_schedule.transition_event_id,
    'retry_at', v_schedule.retry_at,
    'decision_reason', v_schedule.decision_reason,
    'policy_version', v_schedule.policy_version,
    'scheduled_at', v_schedule.scheduled_at,
    'claimed_by', v_schedule.claimed_by,
    'claimed_at', v_schedule.claimed_at,
    'lease_token', v_schedule.lease_token,
    'lease_until', v_schedule.lease_until,
    'completed_at', v_schedule.completed_at
  );
end;
$$;

create or replace function public.renew_held_recovery_retry_schedule_lease_atomic(
  p_lease jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_id uuid;
  v_claimed_by text;
  v_lease_token uuid;
  v_lease_until timestamptz;
  v_schedule public.held_recovery_retry_schedules%rowtype;
begin
  if p_lease is null or jsonb_typeof(p_lease) <> 'object' then
    raise exception 'Held Recovery retry schedule lease renewal blocked: p_lease must be a JSON object';
  end if;

  v_schedule_id := (p_lease ->> 'schedule_id')::uuid;
  v_claimed_by := nullif(btrim(p_lease ->> 'claimed_by'), '');
  v_lease_token := (p_lease ->> 'lease_token')::uuid;
  v_lease_until := (p_lease ->> 'lease_until')::timestamptz;

  if v_schedule_id is null
     or v_claimed_by is null
     or v_lease_token is null
     or v_lease_until is null then
    raise exception 'Held Recovery retry schedule lease renewal blocked: required lease fields are missing';
  end if;

  if v_lease_until <= now() then
    return jsonb_build_object(
      'status', 'persistence_failed',
      'reason', 'invalid_lease_until'
    );
  end if;

  select *
  into v_schedule
  from public.held_recovery_retry_schedules s
  where s.id = v_schedule_id
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'existing_retry_schedule',
      'actual_state', null
    );
  end if;

  if v_schedule.completed_at is not null then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'retry_schedule_open',
      'actual_state', 'completed'
    );
  end if;

  if v_schedule.claimed_by is distinct from v_claimed_by
     or v_schedule.lease_token is distinct from v_lease_token
     or v_schedule.lease_until <= now() then
    return jsonb_build_object(
      'status', 'lease_conflict',
      'reason', 'stale_or_not_owner'
    );
  end if;

  update public.held_recovery_retry_schedules
  set lease_until = v_lease_until,
      updated_at = now()
  where id = v_schedule_id
    and claimed_by = v_claimed_by
    and lease_token = v_lease_token
    and completed_at is null
  returning * into v_schedule;

  return jsonb_build_object(
    'status', 'renewed',
    'id', v_schedule.id,
    'schedule_idempotency_key', v_schedule.schedule_idempotency_key,
    'held_item_id', v_schedule.held_item_id,
    'attempt_id', v_schedule.attempt_id,
    'transition_event_id', v_schedule.transition_event_id,
    'retry_at', v_schedule.retry_at,
    'decision_reason', v_schedule.decision_reason,
    'policy_version', v_schedule.policy_version,
    'scheduled_at', v_schedule.scheduled_at,
    'claimed_by', v_schedule.claimed_by,
    'claimed_at', v_schedule.claimed_at,
    'lease_token', v_schedule.lease_token,
    'lease_until', v_schedule.lease_until,
    'completed_at', v_schedule.completed_at
  );
end;
$$;

create or replace function public.release_held_recovery_retry_schedule_lease_atomic(
  p_lease jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_id uuid;
  v_claimed_by text;
  v_lease_token uuid;
  v_schedule public.held_recovery_retry_schedules%rowtype;
begin
  if p_lease is null or jsonb_typeof(p_lease) <> 'object' then
    raise exception 'Held Recovery retry schedule lease release blocked: p_lease must be a JSON object';
  end if;

  v_schedule_id := (p_lease ->> 'schedule_id')::uuid;
  v_claimed_by := nullif(btrim(p_lease ->> 'claimed_by'), '');
  v_lease_token := (p_lease ->> 'lease_token')::uuid;

  if v_schedule_id is null
     or v_claimed_by is null
     or v_lease_token is null then
    raise exception 'Held Recovery retry schedule lease release blocked: required lease fields are missing';
  end if;

  select *
  into v_schedule
  from public.held_recovery_retry_schedules s
  where s.id = v_schedule_id
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'existing_retry_schedule',
      'actual_state', null
    );
  end if;

  if v_schedule.completed_at is not null then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'retry_schedule_open',
      'actual_state', 'completed'
    );
  end if;

  if v_schedule.claimed_by is distinct from v_claimed_by
     or v_schedule.lease_token is distinct from v_lease_token
     or v_schedule.lease_until <= now() then
    return jsonb_build_object(
      'status', 'lease_conflict',
      'reason', 'stale_or_not_owner'
    );
  end if;

  update public.held_recovery_retry_schedules
  set claimed_by = null,
      claimed_at = null,
      lease_token = null,
      lease_until = null,
      updated_at = now()
  where id = v_schedule_id
    and claimed_by = v_claimed_by
    and lease_token = v_lease_token
    and completed_at is null
  returning * into v_schedule;

  return jsonb_build_object(
    'status', 'released',
    'id', v_schedule.id,
    'schedule_idempotency_key', v_schedule.schedule_idempotency_key,
    'held_item_id', v_schedule.held_item_id,
    'attempt_id', v_schedule.attempt_id,
    'transition_event_id', v_schedule.transition_event_id,
    'retry_at', v_schedule.retry_at,
    'decision_reason', v_schedule.decision_reason,
    'policy_version', v_schedule.policy_version,
    'scheduled_at', v_schedule.scheduled_at,
    'claimed_by', v_schedule.claimed_by,
    'claimed_at', v_schedule.claimed_at,
    'lease_token', v_schedule.lease_token,
    'lease_until', v_schedule.lease_until,
    'completed_at', v_schedule.completed_at
  );
end;
$$;

create or replace function public.complete_held_recovery_retry_schedule_atomic(
  p_completion jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule_id uuid;
  v_claimed_by text;
  v_lease_token uuid;
  v_completed_at timestamptz;
  v_schedule public.held_recovery_retry_schedules%rowtype;
begin
  if p_completion is null or jsonb_typeof(p_completion) <> 'object' then
    raise exception 'Held Recovery retry schedule completion blocked: p_completion must be a JSON object';
  end if;

  v_schedule_id := (p_completion ->> 'schedule_id')::uuid;
  v_claimed_by := nullif(btrim(p_completion ->> 'claimed_by'), '');
  v_lease_token := (p_completion ->> 'lease_token')::uuid;
  v_completed_at := coalesce((p_completion ->> 'completed_at')::timestamptz, now());

  if v_schedule_id is null
     or v_claimed_by is null
     or v_lease_token is null then
    raise exception 'Held Recovery retry schedule completion blocked: required completion fields are missing';
  end if;

  select *
  into v_schedule
  from public.held_recovery_retry_schedules s
  where s.id = v_schedule_id
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', 'existing_retry_schedule',
      'actual_state', null
    );
  end if;

  if v_schedule.claimed_by is distinct from v_claimed_by
     or v_schedule.lease_token is distinct from v_lease_token
     or v_schedule.lease_until <= now() then
    return jsonb_build_object(
      'status', 'lease_conflict',
      'reason', 'stale_or_not_owner'
    );
  end if;

  if v_schedule.completed_at is not null then
    return jsonb_build_object(
      'status', 'completed',
      'id', v_schedule.id,
      'schedule_idempotency_key', v_schedule.schedule_idempotency_key,
      'held_item_id', v_schedule.held_item_id,
      'attempt_id', v_schedule.attempt_id,
      'transition_event_id', v_schedule.transition_event_id,
      'retry_at', v_schedule.retry_at,
      'decision_reason', v_schedule.decision_reason,
      'policy_version', v_schedule.policy_version,
      'scheduled_at', v_schedule.scheduled_at,
      'claimed_by', v_schedule.claimed_by,
      'claimed_at', v_schedule.claimed_at,
      'lease_token', v_schedule.lease_token,
      'lease_until', v_schedule.lease_until,
      'completed_at', v_schedule.completed_at
    );
  end if;

  update public.held_recovery_retry_schedules
  set completed_at = v_completed_at,
      updated_at = now()
  where id = v_schedule_id
    and claimed_by = v_claimed_by
    and lease_token = v_lease_token
    and completed_at is null
  returning * into v_schedule;

  return jsonb_build_object(
    'status', 'completed',
    'id', v_schedule.id,
    'schedule_idempotency_key', v_schedule.schedule_idempotency_key,
    'held_item_id', v_schedule.held_item_id,
    'attempt_id', v_schedule.attempt_id,
    'transition_event_id', v_schedule.transition_event_id,
    'retry_at', v_schedule.retry_at,
    'decision_reason', v_schedule.decision_reason,
    'policy_version', v_schedule.policy_version,
    'scheduled_at', v_schedule.scheduled_at,
    'claimed_by', v_schedule.claimed_by,
    'claimed_at', v_schedule.claimed_at,
    'lease_token', v_schedule.lease_token,
    'lease_until', v_schedule.lease_until,
    'completed_at', v_schedule.completed_at
  );
end;
$$;

revoke all on function public.claim_held_recovery_retry_schedule_atomic(jsonb) from public;
revoke all on function public.claim_held_recovery_retry_schedule_atomic(jsonb) from authenticated;
revoke all on function public.claim_held_recovery_retry_schedule_atomic(jsonb) from anon;
grant execute on function public.claim_held_recovery_retry_schedule_atomic(jsonb) to service_role;

revoke all on function public.renew_held_recovery_retry_schedule_lease_atomic(jsonb) from public;
revoke all on function public.renew_held_recovery_retry_schedule_lease_atomic(jsonb) from authenticated;
revoke all on function public.renew_held_recovery_retry_schedule_lease_atomic(jsonb) from anon;
grant execute on function public.renew_held_recovery_retry_schedule_lease_atomic(jsonb) to service_role;

revoke all on function public.release_held_recovery_retry_schedule_lease_atomic(jsonb) from public;
revoke all on function public.release_held_recovery_retry_schedule_lease_atomic(jsonb) from authenticated;
revoke all on function public.release_held_recovery_retry_schedule_lease_atomic(jsonb) from anon;
grant execute on function public.release_held_recovery_retry_schedule_lease_atomic(jsonb) to service_role;

revoke all on function public.complete_held_recovery_retry_schedule_atomic(jsonb) from public;
revoke all on function public.complete_held_recovery_retry_schedule_atomic(jsonb) from authenticated;
revoke all on function public.complete_held_recovery_retry_schedule_atomic(jsonb) from anon;
grant execute on function public.complete_held_recovery_retry_schedule_atomic(jsonb) to service_role;

comment on function public.claim_held_recovery_retry_schedule_atomic(jsonb) is
  'Atomic Held Recovery retry schedule claim runtime. Claims only due, current, retryable schedule rows and never dispatches or executes recovery.';

comment on function public.renew_held_recovery_retry_schedule_lease_atomic(jsonb) is
  'Atomic Held Recovery retry schedule lease renewal. Only the current active lease owner may renew.';

comment on function public.release_held_recovery_retry_schedule_lease_atomic(jsonb) is
  'Atomic Held Recovery retry schedule lease release. Only the current active lease owner may release.';

comment on function public.complete_held_recovery_retry_schedule_atomic(jsonb) is
  'Atomic Held Recovery retry schedule completion. Only the current active lease owner may mark a schedule complete; this does not dispatch or execute recovery.';

commit;