-- Phase 2E: RPC for auditable RLS policy verification
-- Queries pg_catalog internally (not exposed by PostgREST), returns a stable contract.

create or replace function public.verify_phase2e_rls_policies()
returns table (
  schemaname text,
  tablename text,
  rls_enabled boolean,
  rls_forced boolean,
  policyname text,
  cmd text,
  roles name[],
  qual text,
  with_check text
)
language sql
security definer
set search_path = pg_catalog, public
as $$
  with targets as (
    select 'public'::text as schemaname,
           unnest(array['manuscripts','manuscript_chunks'])::text as tablename
  ),
  rls as (
    select
      n.nspname::text as schemaname,
      c.relname::text as tablename,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join targets t on t.schemaname = n.nspname and t.tablename = c.relname
    where c.relkind = 'r'
  )
  select
    r.schemaname,
    r.tablename,
    r.rls_enabled,
    r.rls_forced,
    p.policyname::text,
    p.cmd::text,
    p.roles,
    p.qual,
    p.with_check
  from rls r
  left join pg_policies p
    on p.schemaname = r.schemaname
   and p.tablename = r.tablename
  order by r.tablename, p.policyname nulls last;
$$;

revoke all on function public.verify_phase2e_rls_policies() from public;
grant execute on function public.verify_phase2e_rls_policies() to service_role;
