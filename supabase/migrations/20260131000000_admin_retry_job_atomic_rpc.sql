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
      worker_id = null,
      lease_until = null,
      failed_at = null,
      updated_at = now()
    where
      j.id = p_job_id
      and j.status in ('failed', 'dead_lettered')
      and (j.lease_until is null or j.lease_until <= now())
    returning j.id, 'queued'::text as status
  )
  select
    coalesce(u.id, p_job_id) as job_id,
    coalesce(
      u.status,
      (select j2.status from public.evaluation_jobs j2 where j2.id = p_job_id)
    ) as status,
    (u.id is not null) as changed
  from updated u
  right join (select 1) one on true;
end;
$$;
