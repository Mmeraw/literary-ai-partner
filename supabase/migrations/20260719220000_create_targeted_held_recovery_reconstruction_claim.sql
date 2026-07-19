begin;

create unique index if not exists evaluation_jobs_one_held_recovery_proof_hold_idx
  on public.evaluation_jobs ((progress ->> 'held_recovery_proof_hold'))
  where status = 'queued'
    and phase_status = 'awaiting_approval'
    and progress ->> 'held_recovery_proof_hold' = 'true';

comment on index public.evaluation_jobs_one_held_recovery_proof_hold_idx is
  'Permits at most one explicitly marked, undispatched Held Recovery proof job. Ordinary Review Gate jobs are excluded.';

create or replace function public.claim_held_recovery_reconstruction_work_for_opportunities_atomic(
  p_worker_id text,
  p_lease_seconds integer,
  p_opportunity_ids text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_worker_id text := nullif(btrim(p_worker_id), '');
  v_lease_seconds integer := p_lease_seconds;
  v_opportunity_ids text[] := p_opportunity_ids;
  v_now timestamptz := now();
  v_claim_token uuid := gen_random_uuid();
  v_claimed public.held_recovery_reconstruction_work_items%rowtype;
begin
  if v_worker_id is null then
    raise exception 'Targeted Held Recovery reconstruction claim blocked: worker_id is required';
  end if;
  if v_lease_seconds is null or v_lease_seconds <= 0 then
    raise exception 'Targeted Held Recovery reconstruction claim blocked: lease_seconds must be positive';
  end if;
  if v_opportunity_ids is null or cardinality(v_opportunity_ids) = 0 then
    return jsonb_build_object('status', 'no_work_available');
  end if;
  if exists (
    select 1
    from unnest(v_opportunity_ids) as opportunity_id
    where opportunity_id is null or btrim(opportunity_id) = ''
  ) then
    raise exception 'Targeted Held Recovery reconstruction claim blocked: opportunity ids must be non-empty';
  end if;

  with candidate as (
    select w.id
    from public.held_recovery_reconstruction_work_items w
    where w.opportunity_id = any(v_opportunity_ids)
      and (
        w.status = 'pending'
        or (
          w.status = 'running'
          and w.lease_expires_at is not null
          and w.lease_expires_at < v_now
        )
      )
    order by w.created_at asc
    for update skip locked
    limit 1
  )
  update public.held_recovery_reconstruction_work_items w
  set status = 'running',
      claim_token = v_claim_token,
      claimed_by = v_worker_id,
      lease_expires_at = v_now + make_interval(secs => v_lease_seconds),
      attempt_count = w.attempt_count + 1
  from candidate
  where w.id = candidate.id
  returning w.* into v_claimed;

  if not found then
    return jsonb_build_object('status', 'no_work_available');
  end if;

  return jsonb_build_object(
    'status', 'claimed',
    'work_item_id', v_claimed.id,
    'claim_token', v_claimed.claim_token,
    'claimed_by', v_claimed.claimed_by,
    'lease_expires_at', v_claimed.lease_expires_at,
    'attempt_count', v_claimed.attempt_count,
    'held_item_id', v_claimed.held_item_id,
    'opportunity_id', v_claimed.opportunity_id,
    'manuscript_id', v_claimed.manuscript_id,
    'manuscript_version_sha', v_claimed.manuscript_version_sha,
    'held_item_persisted_version', v_claimed.held_item_persisted_version,
    'source_hash', v_claimed.source_hash,
    'source_start_offset', v_claimed.source_start_offset,
    'source_end_offset', v_claimed.source_end_offset,
    'recovery_method', v_claimed.recovery_method
  );
end;
$$;

revoke all on function public.claim_held_recovery_reconstruction_work_for_opportunities_atomic(text, integer, text[]) from public;
revoke all on function public.claim_held_recovery_reconstruction_work_for_opportunities_atomic(text, integer, text[]) from anon;
revoke all on function public.claim_held_recovery_reconstruction_work_for_opportunities_atomic(text, integer, text[]) from authenticated;
grant execute on function public.claim_held_recovery_reconstruction_work_for_opportunities_atomic(text, integer, text[]) to service_role;

comment on function public.claim_held_recovery_reconstruction_work_for_opportunities_atomic(text, integer, text[]) is
  'Target-filtered form of the existing reconstruction claim authority. It claims only work whose immutable opportunity_id belongs to the explicitly selected evaluation job. It does not classify, enqueue, transition, or create recovery work.';

commit;
