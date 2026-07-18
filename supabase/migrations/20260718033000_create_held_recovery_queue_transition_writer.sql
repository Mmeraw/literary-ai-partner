begin;

create table if not exists public.held_recovery_queue_items (
  held_item_id text primary key,
  queue_state text not null check (queue_state in (
    'held',
    'recovery_attempt_pending',
    'recovery_attempt_running',
    'recovery_attempt_failed_retryable',
    'recovery_attempt_failed_terminal',
    'recovered_pending_reclassification',
    'reclassified',
    'dismissed'
  )),
  authority_version text not null,
  last_transition_idempotency_key text null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.held_recovery_queue_items enable row level security;

drop policy if exists "Service role: full access" on public.held_recovery_queue_items;
create policy "Service role: full access"
  on public.held_recovery_queue_items
  for all
  to service_role
  using (true)
  with check (true);

create table if not exists public.held_recovery_queue_transition_events (
  id uuid primary key default gen_random_uuid(),
  transition_idempotency_key text not null unique,
  held_item_id text not null references public.held_recovery_queue_items(held_item_id) on delete cascade,
  from_state text not null check (from_state in (
    'held',
    'recovery_attempt_pending',
    'recovery_attempt_running',
    'recovery_attempt_failed_retryable',
    'recovery_attempt_failed_terminal',
    'recovered_pending_reclassification',
    'reclassified',
    'dismissed'
  )),
  to_state text not null check (to_state in (
    'held',
    'recovery_attempt_pending',
    'recovery_attempt_running',
    'recovery_attempt_failed_retryable',
    'recovery_attempt_failed_terminal',
    'recovered_pending_reclassification',
    'reclassified',
    'dismissed'
  )),
  decision_reason text not null check (decision_reason in ('canonical_state_machine_allows_transition')),
  decision_authority_version text not null,
  next_authority_version text not null,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.held_recovery_queue_transition_events enable row level security;

drop policy if exists "Service role: full access" on public.held_recovery_queue_transition_events;
create policy "Service role: full access"
  on public.held_recovery_queue_transition_events
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_held_recovery_queue_transition_events_held_item_id
  on public.held_recovery_queue_transition_events(held_item_id);

create or replace function public.apply_held_recovery_queue_transition_atomic(
  p_transition jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_held_item_id text;
  v_transition_idempotency_key text;
  v_from_state text;
  v_to_state text;
  v_decision_reason text;
  v_decision_authority_version text;
  v_next_authority_version text;
  v_applied_at timestamptz;
  v_current_state text;
  v_current_authority_version text;
  v_existing_event public.held_recovery_queue_transition_events%rowtype;
begin
  if p_transition is null or jsonb_typeof(p_transition) <> 'object' then
    raise exception 'Held Recovery queue transition blocked: p_transition must be a JSON object';
  end if;

  v_held_item_id := nullif(btrim(p_transition ->> 'held_item_id'), '');
  v_transition_idempotency_key := nullif(btrim(p_transition ->> 'transition_idempotency_key'), '');
  v_from_state := nullif(btrim(p_transition ->> 'from_state'), '');
  v_to_state := nullif(btrim(p_transition ->> 'to_state'), '');
  v_decision_reason := nullif(btrim(p_transition ->> 'decision_reason'), '');
  v_decision_authority_version := nullif(btrim(p_transition ->> 'decision_authority_version'), '');
  v_next_authority_version := nullif(btrim(p_transition ->> 'next_authority_version'), '');
  v_applied_at := coalesce((p_transition ->> 'applied_at')::timestamptz, now());

  if v_held_item_id is null
     or v_transition_idempotency_key is null
     or v_from_state is null
     or v_to_state is null
     or v_decision_reason is null
     or v_decision_authority_version is null
     or v_next_authority_version is null then
    raise exception 'Held Recovery queue transition blocked: required transition fields are missing';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(v_held_item_id),
    hashtext(v_transition_idempotency_key)
  );

  select *
  into v_existing_event
  from public.held_recovery_queue_transition_events events
  where events.transition_idempotency_key = v_transition_idempotency_key;

  if found then
    if v_existing_event.decision_authority_version is distinct from v_decision_authority_version
       or v_existing_event.next_authority_version is distinct from v_next_authority_version then
      return jsonb_build_object(
        'status', 'rejected_stale',
        'expected_authority_version', v_decision_authority_version,
        'actual_authority_version', v_existing_event.decision_authority_version
      );
    end if;

    if v_existing_event.held_item_id is distinct from v_held_item_id
       or v_existing_event.from_state is distinct from v_from_state
       or v_existing_event.to_state is distinct from v_to_state
       or v_existing_event.decision_reason is distinct from v_decision_reason then
      return jsonb_build_object(
        'status', 'rejected_state_mismatch',
        'expected_state', v_from_state,
        'actual_state', v_existing_event.from_state
      );
    end if;

    return jsonb_build_object(
      'status', 'already_applied',
      'held_item_id', v_existing_event.held_item_id,
      'transition_idempotency_key', v_existing_event.transition_idempotency_key,
      'from_state', v_existing_event.from_state,
      'to_state', v_existing_event.to_state,
      'decision_reason', v_existing_event.decision_reason,
      'decision_authority_version', v_existing_event.decision_authority_version,
      'next_authority_version', v_existing_event.next_authority_version,
      'applied_at', v_existing_event.applied_at
    );
  end if;

  select queue_state, authority_version
  into v_current_state, v_current_authority_version
  from public.held_recovery_queue_items
  where held_item_id = v_held_item_id
  for update;

  if v_current_state is null then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', v_from_state,
      'actual_state', null
    );
  end if;

  if v_current_authority_version is distinct from v_decision_authority_version then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'expected_authority_version', v_decision_authority_version,
      'actual_authority_version', v_current_authority_version
    );
  end if;

  if v_current_state is distinct from v_from_state then
    return jsonb_build_object(
      'status', 'rejected_state_mismatch',
      'expected_state', v_from_state,
      'actual_state', v_current_state
    );
  end if;

  update public.held_recovery_queue_items
  set queue_state = v_to_state,
      authority_version = v_next_authority_version,
      last_transition_idempotency_key = v_transition_idempotency_key,
      updated_at = v_applied_at
  where held_item_id = v_held_item_id
    and queue_state = v_from_state
    and authority_version = v_decision_authority_version;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_stale',
      'expected_authority_version', v_decision_authority_version,
      'actual_authority_version', null
    );
  end if;

  insert into public.held_recovery_queue_transition_events (
    transition_idempotency_key,
    held_item_id,
    from_state,
    to_state,
    decision_reason,
    decision_authority_version,
    next_authority_version,
    applied_at
  ) values (
    v_transition_idempotency_key,
    v_held_item_id,
    v_from_state,
    v_to_state,
    v_decision_reason,
    v_decision_authority_version,
    v_next_authority_version,
    v_applied_at
  );

  return jsonb_build_object(
    'status', 'applied',
    'held_item_id', v_held_item_id,
    'transition_idempotency_key', v_transition_idempotency_key,
    'from_state', v_from_state,
    'to_state', v_to_state,
    'decision_reason', v_decision_reason,
    'decision_authority_version', v_decision_authority_version,
    'next_authority_version', v_next_authority_version,
    'applied_at', v_applied_at
  );
end;
$$;

revoke all on function public.apply_held_recovery_queue_transition_atomic(jsonb) from public;
revoke all on function public.apply_held_recovery_queue_transition_atomic(jsonb) from authenticated;
revoke all on function public.apply_held_recovery_queue_transition_atomic(jsonb) from anon;
grant execute on function public.apply_held_recovery_queue_transition_atomic(jsonb) to service_role;

comment on table public.held_recovery_queue_items is
  'Durable Held Recovery queue state authority. This table stores queue transition state only; it does not schedule retries, invoke recovery, mutate attempts, candidates, manuscripts, or Final Review.';

comment on table public.held_recovery_queue_transition_events is
  'Append-only Held Recovery queue transition provenance. Events are written only by the atomic transition writer and do not schedule retries or mutate downstream artifacts.';

comment on function public.apply_held_recovery_queue_transition_atomic(jsonb) is
  'Atomic compare-and-set writer for Held Recovery queue transitions. Applies exactly the requested allowed transition when held_item_id, from_state, and authority_version still match.';

commit;