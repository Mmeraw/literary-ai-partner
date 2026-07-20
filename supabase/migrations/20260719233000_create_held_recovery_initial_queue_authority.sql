begin;

alter table public.held_recovery_queue_items
  add column if not exists evaluation_job_id text null,
  add column if not exists opportunity_id text null,
  add column if not exists manuscript_id text null,
  add column if not exists manuscript_version_sha text null,
  add column if not exists held_item_persisted_version text null,
  add column if not exists deferred_attempt_idempotency_key text null;

create unique index if not exists held_recovery_queue_items_job_opportunity_unique
  on public.held_recovery_queue_items(evaluation_job_id, opportunity_id)
  where evaluation_job_id is not null and opportunity_id is not null;

create or replace function public.get_held_recovery_proof_job_context(
  p_job_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_job public.evaluation_jobs%rowtype;
begin
  if p_job_id is null or btrim(p_job_id) = '' then
    raise exception 'Held Recovery proof context blocked: job id is required';
  end if;

  select * into v_job
  from public.evaluation_jobs j
  where j.id::text = btrim(p_job_id);

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  return jsonb_build_object(
    'status', 'loaded',
    'job_id', v_job.id::text,
    'job_status', v_job.status,
    'phase_status', v_job.phase_status,
    'manuscript_id', v_job.manuscript_id::text,
    'user_id', v_job.user_id::text,
    'proof_target', coalesce((v_job.progress ->> 'held_recovery_proof_target')::boolean, false)
  );
end;
$$;

create or replace function public.initialize_held_recovery_queue_authority_atomic(
  p_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evaluation_job_id text;
  v_held_item_id text;
  v_opportunity_id text;
  v_manuscript_id text;
  v_manuscript_version_sha text;
  v_held_item_persisted_version text;
  v_deferred_attempt_idempotency_key text;
  v_attempt public.held_recovery_attempts%rowtype;
  v_work public.held_recovery_reconstruction_work_items%rowtype;
  v_existing public.held_recovery_queue_items%rowtype;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception 'Held Recovery queue authority blocked: p_request must be an object';
  end if;

  v_evaluation_job_id := nullif(btrim(p_request ->> 'evaluation_job_id'), '');
  v_held_item_id := nullif(btrim(p_request ->> 'held_item_id'), '');
  v_opportunity_id := nullif(btrim(p_request ->> 'opportunity_id'), '');
  v_manuscript_id := nullif(btrim(p_request ->> 'manuscript_id'), '');
  v_manuscript_version_sha := nullif(btrim(p_request ->> 'manuscript_version_sha'), '');
  v_held_item_persisted_version := nullif(btrim(p_request ->> 'held_item_persisted_version'), '');
  v_deferred_attempt_idempotency_key := nullif(
    btrim(p_request ->> 'deferred_attempt_idempotency_key'),
    ''
  );

  if v_evaluation_job_id is null
     or v_held_item_id is null
     or v_opportunity_id is null
     or v_manuscript_id is null
     or v_manuscript_version_sha is null
     or v_held_item_persisted_version is null
     or v_deferred_attempt_idempotency_key is null then
    raise exception 'Held Recovery queue authority blocked: required identity fields are missing';
  end if;

  if v_manuscript_id !~ '^(0|[1-9][0-9]*)$' then
    raise exception 'Held Recovery queue authority blocked: manuscript_id must be canonical decimal text';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_held_item_id));

  select * into v_attempt
  from public.held_recovery_attempts a
  where a.idempotency_key = v_deferred_attempt_idempotency_key;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_missing_deferred_authority',
      'reason', 'deferred_attempt_missing'
    );
  end if;

  select * into v_work
  from public.held_recovery_reconstruction_work_items w
  where w.originating_attempt_id = v_attempt.id;

  if not found then
    return jsonb_build_object(
      'status', 'rejected_missing_deferred_authority',
      'reason', 'reconstruction_work_missing'
    );
  end if;

  if v_attempt.runtime_outcome_status <> 'deferred'
     or v_attempt.held_item_id is distinct from v_held_item_id
     or v_attempt.opportunity_id is distinct from v_opportunity_id
     or v_attempt.manuscript_id::text is distinct from v_manuscript_id
     or v_attempt.manuscript_version_sha is distinct from v_manuscript_version_sha
     or v_attempt.held_item_persisted_version is distinct from v_held_item_persisted_version
     or v_work.held_item_id is distinct from v_held_item_id
     or v_work.opportunity_id is distinct from v_opportunity_id
     or v_work.manuscript_id is distinct from v_manuscript_id
     or v_work.manuscript_version_sha is distinct from v_manuscript_version_sha
     or v_work.held_item_persisted_version is distinct from v_held_item_persisted_version then
    return jsonb_build_object(
      'status', 'rejected_identity_mismatch',
      'reason', 'deferred_attempt_or_work_identity_mismatch'
    );
  end if;

  select * into v_existing
  from public.held_recovery_queue_items q
  where q.held_item_id = v_held_item_id
  for update;

  if found then
    if v_existing.evaluation_job_id is distinct from v_evaluation_job_id
       or v_existing.opportunity_id is distinct from v_opportunity_id
       or v_existing.manuscript_id is distinct from v_manuscript_id
       or v_existing.manuscript_version_sha is distinct from v_manuscript_version_sha
       or v_existing.held_item_persisted_version is distinct from v_held_item_persisted_version
       or v_existing.deferred_attempt_idempotency_key is distinct from v_deferred_attempt_idempotency_key then
      return jsonb_build_object(
        'status', 'rejected_identity_mismatch',
        'reason', 'existing_queue_authority_identity_mismatch'
      );
    end if;

    if v_existing.queue_state not in (
      'recovery_attempt_running',
      'recovered_pending_reclassification',
      'reclassified'
    ) then
      return jsonb_build_object(
        'status', 'rejected_identity_mismatch',
        'reason', 'existing_queue_authority_state_mismatch'
      );
    end if;

    return jsonb_build_object(
      'status', 'already_created',
      'held_item_id', v_existing.held_item_id,
      'queue_state', v_existing.queue_state,
      'authority_version', v_existing.authority_version
    );
  end if;

  insert into public.held_recovery_queue_items (
    held_item_id,
    queue_state,
    authority_version,
    evaluation_job_id,
    opportunity_id,
    manuscript_id,
    manuscript_version_sha,
    held_item_persisted_version,
    deferred_attempt_idempotency_key
  ) values (
    v_held_item_id,
    'recovery_attempt_running',
    v_held_item_persisted_version,
    v_evaluation_job_id,
    v_opportunity_id,
    v_manuscript_id,
    v_manuscript_version_sha,
    v_held_item_persisted_version,
    v_deferred_attempt_idempotency_key
  );

  return jsonb_build_object(
    'status', 'created',
    'held_item_id', v_held_item_id,
    'queue_state', 'recovery_attempt_running',
    'authority_version', v_held_item_persisted_version
  );
exception
  when unique_violation then
    return jsonb_build_object(
      'status', 'rejected_identity_mismatch',
      'reason', 'job_opportunity_already_bound_to_another_held_identity'
    );
end;
$$;

create or replace function public.get_completed_held_recovery_reconstruction_for_opportunities(
  p_evaluation_job_id text,
  p_opportunity_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_count integer;
  v_candidates jsonb;
  v_work public.held_recovery_reconstruction_work_items%rowtype;
  v_completion_fingerprint text;
begin
  if p_evaluation_job_id is null or btrim(p_evaluation_job_id) = '' then
    raise exception 'Held Recovery completed handoff blocked: evaluation job id is required';
  end if;
  if p_opportunity_ids is null or cardinality(p_opportunity_ids) = 0 then
    return jsonb_build_object('status', 'no_completed_work');
  end if;

  -- Materialize at most two complete candidate rows in one READ COMMITTED
  -- statement. This makes none/one/ambiguous classification immune to a
  -- rowset change between a count and a later SELECT INTO.
  select coalesce(jsonb_agg(candidate.row_payload order by candidate.work_item_id), '[]'::jsonb)
  into v_candidates
  from (
    select w.id as work_item_id, to_jsonb(w) as row_payload
    from public.held_recovery_reconstruction_work_items w
    join public.held_recovery_queue_items q on q.held_item_id = w.held_item_id
    where q.evaluation_job_id = btrim(p_evaluation_job_id)
      and w.opportunity_id = any(p_opportunity_ids)
      and q.opportunity_id = w.opportunity_id
      and q.manuscript_id = w.manuscript_id
      and q.manuscript_version_sha = w.manuscript_version_sha
      and q.held_item_persisted_version = w.held_item_persisted_version
      and w.status = 'completed'
      and q.queue_state <> 'reclassified'
    order by w.id
    limit 2
  ) candidate;

  v_count := jsonb_array_length(v_candidates);

  if v_count = 0 then
    return jsonb_build_object('status', 'no_completed_work');
  end if;
  if v_count > 1 then
    return jsonb_build_object(
      'status', 'ambiguous_completed_work',
      'completed_work_count', v_count
    );
  end if;

  select * into v_work
  from jsonb_populate_record(
    null::public.held_recovery_reconstruction_work_items,
    v_candidates -> 0
  );

  v_completion_fingerprint := nullif(btrim(v_work.details ->> 'completion_fingerprint'), '');
  if v_completion_fingerprint is null then
    return jsonb_build_object(
      'status', 'invalid_completed_work',
      'reason', 'completion_fingerprint_missing'
    );
  end if;

  return jsonb_build_object(
    'status', 'loaded',
    'work_item_id', v_work.id,
    'held_item_id', v_work.held_item_id,
    'opportunity_id', v_work.opportunity_id,
    'manuscript_id', v_work.manuscript_id,
    'manuscript_version_sha', v_work.manuscript_version_sha,
    'held_item_persisted_version', v_work.held_item_persisted_version,
    'source_hash', v_work.source_hash,
    'source_start_offset', v_work.source_start_offset,
    'source_end_offset', v_work.source_end_offset,
    'recovery_method', v_work.recovery_method,
    'completion_fingerprint', v_completion_fingerprint
  );
end;
$$;

revoke all on function public.initialize_held_recovery_queue_authority_atomic(jsonb) from public;
revoke all on function public.initialize_held_recovery_queue_authority_atomic(jsonb) from anon;
revoke all on function public.initialize_held_recovery_queue_authority_atomic(jsonb) from authenticated;
grant execute on function public.initialize_held_recovery_queue_authority_atomic(jsonb) to service_role;

revoke all on function public.get_held_recovery_proof_job_context(text) from public;
revoke all on function public.get_held_recovery_proof_job_context(text) from anon;
revoke all on function public.get_held_recovery_proof_job_context(text) from authenticated;
grant execute on function public.get_held_recovery_proof_job_context(text) to service_role;

revoke all on function public.get_completed_held_recovery_reconstruction_for_opportunities(text, text[]) from public;
revoke all on function public.get_completed_held_recovery_reconstruction_for_opportunities(text, text[]) from anon;
revoke all on function public.get_completed_held_recovery_reconstruction_for_opportunities(text, text[]) from authenticated;
grant execute on function public.get_completed_held_recovery_reconstruction_for_opportunities(text, text[]) to service_role;

comment on function public.initialize_held_recovery_queue_authority_atomic(jsonb) is
  'Creates one durable Held Recovery queue identity only after verifying the identity-equivalent deferred attempt and reconstruction work item. Idempotent for the same proof identity; fails closed on conflicts.';

commit;
