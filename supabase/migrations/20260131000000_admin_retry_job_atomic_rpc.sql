-- A5: Admin retry job (atomic, race-proof)
-- Contract: retry succeeds IFF job is retryable AND not leased AND not terminal-success
-- Returns: { job_id, status, changed } where changed=true means state transition happened

create or replace function public.admin_retry_job(p_job_id uuid)
returns table(job_id uuid, status text, changed boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with updated as (
    update public.evaluation_jobs j
    set
      status = 'queued',
      next_attempt_at = now(),
      lease_owner = null,
      lease_expires_at = null,
      failed_at = null,
      updated_at = now()
    where
      j.id = p_job_id
      -- Retryable terminal states
      and j.status in ('failed', 'dead_lettered')
      -- Not actively leased
      and (j.lease_expires_at is null or j.lease_expires_at <= now())
      -- Not completed/succeeded (redundant but explicit)
      and j.status <> 'complete'
    returning j.id, j.status
  )
  select
    coalesce(u.id, p_job_id) as job_id,
    coalesce(
      u.status,
      (select status from public.evaluation_jobs where id = p_job_id)
    ) as status,
    (u.id is not null) as changed
  from updated u
  right join (select 1) one on true;
end;
$$;

-- Grant execute to service role only (admin operations)
grant execute on function public.admin_retry_job(uuid) to service_role;
revoke execute on function public.admin_retry_job(uuid) from anon, authenticated;

comment on function public.admin_retry_job is 
  'A5: Atomic admin retry. Returns {job_id, status, changed}. Succeeds only if job is in retryable terminal state and not actively leased.';
