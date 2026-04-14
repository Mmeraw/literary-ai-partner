-- POST-APPLY VERIFICATION
-- Target migration: 20250614000000_rls_fixes.sql
-- Purpose: verify final RLS posture immediately after production apply
-- Status: safe read-only verification

-- ---------------------------------------------------------------------------
-- 1) Confirm target tables exist / are visible
-- ---------------------------------------------------------------------------
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'evaluation_provider_calls',
    'revision_events',
    'jobs',
    'governance_logs',
    'wave_execution_attempts',
    'admin_actions',
    'protected_spans'
  )
order by table_name;

-- ---------------------------------------------------------------------------
-- 2) Confirm RLS enabled state
-- ---------------------------------------------------------------------------
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'evaluation_provider_calls',
    'revision_events',
    'jobs',
    'governance_logs',
    'wave_execution_attempts',
    'admin_actions',
    'protected_spans'
  )
order by c.relname;

-- ---------------------------------------------------------------------------
-- 3) Read back all policies on the target tables
-- ---------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'evaluation_provider_calls',
    'revision_events',
    'jobs',
    'governance_logs',
    'wave_execution_attempts',
    'admin_actions',
    'protected_spans'
  )
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 4) Flag any lingering broad-access roles on internal/system tables
-- Expected result: zero rows
-- ---------------------------------------------------------------------------
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'evaluation_provider_calls',
    'revision_events',
    'governance_logs',
    'wave_execution_attempts',
    'admin_actions',
    'protected_spans'
  )
  and (
    roles::text ilike '%public%'
    or roles::text ilike '%authenticated%'
  )
order by tablename, policyname;

-- ---------------------------------------------------------------------------
-- 5) Count policies per table for quick sanity check
-- Expected result:
--   - one service-role-only policy on each internal/system table
--   - jobs may have one policy if table exists, zero if absent
-- ---------------------------------------------------------------------------
select
  target.table_name,
  count(p.policyname) as policy_count
from (
  values
    ('evaluation_provider_calls'),
    ('revision_events'),
    ('jobs'),
    ('governance_logs'),
    ('wave_execution_attempts'),
    ('admin_actions'),
    ('protected_spans')
) as target(table_name)
left join pg_policies p
  on p.schemaname = 'public'
 and p.tablename = target.table_name
group by target.table_name
order by target.table_name;

-- ---------------------------------------------------------------------------
-- 6) Quick verdict helper: inspect final role targets only
-- Expected result:
--   internal/system tables list only {service_role}
-- ---------------------------------------------------------------------------
select
  tablename,
  policyname,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'evaluation_provider_calls',
    'revision_events',
    'governance_logs',
    'wave_execution_attempts',
    'admin_actions',
    'protected_spans'
  )
order by tablename, policyname;
