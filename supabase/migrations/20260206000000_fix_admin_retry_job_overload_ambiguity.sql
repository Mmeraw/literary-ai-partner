-- A5: Fix admin_retry_job PostgREST ambiguity
-- Purpose: Remove overloads entirely and create single canonical signature
-- Root cause: Earlier migration created multiple overloads; PostgREST PGRST203 cannot disambiguate

-- 1. Drop ALL existing overloads (handles any prior version)
drop function if exists public.admin_retry_job(uuid);
drop function if exists public.admin_retry_job(uuid, text, uuid);
drop function if exists public.admin_retry_job cascade;

-- 2. Create single canonical signature (no ambiguity)
create or replace function public.admin_retry_job(
  p_job_id uuid,
  p_reason text default null,
  p_actor uuid default null
)
returns table(job_id uuid, status text, changed boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- NOTE: p_reason and p_actor are accepted for future auditability logging.
  -- Currently unused in this version; will be persisted to admin_action_log when available.

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

-- Verification query (run after migration to confirm single signature):
-- SELECT proname, oidvectortypes(proargtypes) as argtypes
-- FROM pg_proc
-- JOIN pg_namespace n ON n.oid = pronamespace
-- WHERE n.nspname = 'public' AND proname = 'admin_retry_job';
-- Expected: exactly 1 row
