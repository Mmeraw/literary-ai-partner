-- Enforce an immutable two-hour wall-clock cap for evaluation jobs.
-- The cap is measured from evaluation_jobs.created_at and cannot be reset by
-- heartbeats, updated_at, retries, resumes, leases, rescues, or requeues.
-- Only an explicit, unexpired admin authorization in progress may extend it.

create or replace function public.evaluation_job_admin_runtime_authorized(p_progress jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_typeof(p_progress -> 'admin_runtime_authorization') = 'object'
    and nullif(trim(p_progress #>> '{admin_runtime_authorization,authorized_by}'), '') is not null
    and nullif(trim(p_progress #>> '{admin_runtime_authorization,reason}'), '') is not null
    and (p_progress #>> '{admin_runtime_authorization,authorized_at}') is not null
    and (p_progress #>> '{admin_runtime_authorization,expires_at}') is not null
    and (p_progress #>> '{admin_runtime_authorization,authorized_at}')::timestamptz <= now()
    and (p_progress #>> '{admin_runtime_authorization,expires_at}')::timestamptz > now(),
    false
  );
$$;

comment on function public.evaluation_job_admin_runtime_authorized(jsonb) is
  'Fail-closed validator for explicit, time-limited admin authorization to exceed the absolute evaluation runtime cap.';

create or replace function public.enforce_absolute_evaluation_runtime_cap_on_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('complete', 'failed') then
    return new;
  end if;

  if old.created_at > now() - interval '2 hours' then
    return new;
  end if;

  if public.evaluation_job_admin_runtime_authorized(coalesce(new.progress, old.progress, '{}'::jsonb)) then
    return new;
  end if;

  -- Never allow an over-age queued job to be claimed. Raising here keeps the
  -- lifecycle trigger from seeing an illegal queued -> failed transition.
  if old.status = 'queued' and new.status = 'running' then
    raise exception using
      errcode = 'P0001',
      message = 'ABSOLUTE_RUNTIME_CAP_EXCEEDED',
      detail = format('evaluation job %s is older than two hours from created_at', old.id),
      hint = 'Create a new evaluation job or add an explicit unexpired admin_runtime_authorization.';
  end if;

  -- Any subsequent heartbeat/state write on an over-age running job fails it
  -- closed, even when lease and heartbeat fields were previously null.
  if old.status = 'running' then
    new.status := 'failed';
    new.phase_status := 'failed';
    new.failure_code := 'ABSOLUTE_RUNTIME_CAP_EXCEEDED';
    new.last_error := 'Evaluation exceeded the absolute two-hour runtime cap.';
    new.failed_at := coalesce(new.failed_at, now());
    new.claimed_by := null;
    new.claimed_at := null;
    new.worker_id := null;
    new.lease_token := null;
    new.lease_until := null;
    new.last_heartbeat := null;
    new.last_heartbeat_at := null;
    new.worker_pulse_at := null;
    new.progress := coalesce(new.progress, '{}'::jsonb) || jsonb_build_object(
      'phase_status', 'failed',
      'error_code', 'ABSOLUTE_RUNTIME_CAP_EXCEEDED',
      'message', 'Evaluation exceeded the absolute two-hour runtime cap.',
      'finished_at', now(),
      'retry_eligible', false,
      'resume_eligible', false,
      'recoverable', false
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_absolute_evaluation_runtime_cap on public.evaluation_jobs;
create trigger trg_enforce_absolute_evaluation_runtime_cap
before update on public.evaluation_jobs
for each row
execute function public.enforce_absolute_evaluation_runtime_cap_on_update();

-- Explicit sweeper for cron/operator use. It catches heartbeat-null zombies that
-- would otherwise receive no subsequent update. Queued jobs are moved through
-- the legal queued -> running -> failed lifecycle before terminalization.
create or replace function public.kill_absolute_overage_evaluation_jobs(p_limit integer default 100)
returns table(job_id uuid, prior_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id, status
    from public.evaluation_jobs
    where status in ('queued', 'running')
      and created_at <= now() - interval '2 hours'
      and not public.evaluation_job_admin_runtime_authorized(coalesce(progress, '{}'::jsonb))
    order by created_at asc
    limit greatest(1, least(coalesce(p_limit, 100), 1000))
    for update skip locked
  loop
    if r.status = 'queued' then
      update public.evaluation_jobs
      set status = 'running',
          phase_status = 'running',
          claimed_by = 'absolute-runtime-cap-sweeper',
          claimed_at = now(),
          updated_at = now()
      where id = r.id and status = 'queued';
    end if;

    update public.evaluation_jobs
    set status = 'failed',
        phase_status = 'failed',
        failure_code = 'ABSOLUTE_RUNTIME_CAP_EXCEEDED',
        last_error = 'Evaluation exceeded the absolute two-hour runtime cap.',
        failed_at = now(),
        claimed_by = null,
        claimed_at = null,
        worker_id = null,
        lease_token = null,
        lease_until = null,
        last_heartbeat = null,
        last_heartbeat_at = null,
        worker_pulse_at = null,
        progress = coalesce(progress, '{}'::jsonb) || jsonb_build_object(
          'phase_status', 'failed',
          'error_code', 'ABSOLUTE_RUNTIME_CAP_EXCEEDED',
          'message', 'Evaluation exceeded the absolute two-hour runtime cap.',
          'finished_at', now(),
          'retry_eligible', false,
          'resume_eligible', false,
          'recoverable', false
        ),
        updated_at = now()
    where id = r.id
      and status = 'running';

    if found then
      job_id := r.id;
      prior_status := r.status;
      return next;
    end if;
  end loop;
end;
$$;

comment on function public.kill_absolute_overage_evaluation_jobs(integer) is
  'Fails queued/running evaluation jobs older than two hours from immutable created_at unless explicitly admin-authorized.';

revoke all on function public.evaluation_job_admin_runtime_authorized(jsonb) from public;
revoke all on function public.kill_absolute_overage_evaluation_jobs(integer) from public;
grant execute on function public.evaluation_job_admin_runtime_authorized(jsonb) to service_role;
grant execute on function public.kill_absolute_overage_evaluation_jobs(integer) to service_role;
