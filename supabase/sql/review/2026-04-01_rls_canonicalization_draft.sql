-- REVIEW-ONLY DRAFT
-- Supabase RLS canonicalization draft for audit follow-up
-- Date: 2026-04-01
-- Status: DO NOT APPLY WITHOUT REVIEW
--
-- Scope:
--   1) public.evaluation_provider_calls   -> confirmed live UNRESTRICTED
--   2) public.revision_events             -> confirmed live UNRESTRICTED
--   3) public.governance_logs             -> live RLS enabled but policy target defect
--   4) public.wave_execution_attempts     -> internal table; repo policy shape is defective
--   5) public.admin_actions               -> internal table; canonical policy set is defective
--   6) public.protected_spans             -> reported live internal table; repo migration not present
--
-- Ghost tables intentionally excluded from this draft:
--   - public.job_costs
--   - public.worker_lifecycle_events
-- Live verification established both are absent and currently dead code.
--
-- Ownership rule:
--   evaluation_jobs.manuscript_id -> manuscripts.id -> manuscripts.user_id
--   Do NOT assume evaluation_jobs.user_id exists.
--
-- Internal table posture:
--   governance_logs, wave_execution_attempts, admin_actions, and protected_spans
--   should be service-role-only unless and until a reviewed product requirement proves otherwise.

begin;

-- ---------------------------------------------------------------------------
-- 1) evaluation_provider_calls
-- ---------------------------------------------------------------------------

alter table public.evaluation_provider_calls enable row level security;

drop policy if exists evaluation_provider_calls_service_role_all
  on public.evaluation_provider_calls;
drop policy if exists evaluation_provider_calls_authenticated_select_own
  on public.evaluation_provider_calls;

create policy evaluation_provider_calls_service_role_all
  on public.evaluation_provider_calls
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.evaluation_provider_calls is
  'Audit-grade forensics table for provider calls (OpenAI, etc). Persists request/response/error metadata and canonical result envelope. Canonical version: 2c1.v1';

-- ---------------------------------------------------------------------------
-- 2) revision_events
-- ---------------------------------------------------------------------------

alter table public.revision_events enable row level security;

drop policy if exists revision_events_service_role_all
  on public.revision_events;
drop policy if exists revision_events_authenticated_select_own
  on public.revision_events;

create policy revision_events_service_role_all
  on public.revision_events
  for all
  to service_role
  using (true)
  with check (true);

comment on table public.revision_events is
  'Non-blocking Stage 2 revision telemetry for proposal generation, anchored apply, finalize outcomes, immutability checks, and smoke harness behavior.';

-- ---------------------------------------------------------------------------
-- 3) governance_logs
-- ---------------------------------------------------------------------------
-- Live finding: RLS is enabled, but the existing "Service role full access"
-- policy is reportedly granted to PUBLIC instead of service_role.

alter table public.governance_logs enable row level security;

drop policy if exists "Service role full access"
  on public.governance_logs;
drop policy if exists governance_logs_service_role_all
  on public.governance_logs;
drop policy if exists governance_logs_authenticated_select_own
  on public.governance_logs;

create policy governance_logs_service_role_all
  on public.governance_logs
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 4) wave_execution_attempts
-- ---------------------------------------------------------------------------
-- Repo migration currently creates:
--   - "Users can view own wave attempts"
--   - "Service role can manage wave attempts"
-- The SELECT policy depends on revision_sessions.user_id, which is not present in
-- the canonical revision_sessions migration in this repo. Pending a reviewed end-user
-- product requirement, treat this as an internal/system table.

alter table public.wave_execution_attempts enable row level security;

drop policy if exists "Users can view own wave attempts"
  on public.wave_execution_attempts;
drop policy if exists "Service role can manage wave attempts"
  on public.wave_execution_attempts;
drop policy if exists wave_execution_attempts_service_role_all
  on public.wave_execution_attempts;

create policy wave_execution_attempts_service_role_all
  on public.wave_execution_attempts
  for all
  to service_role
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- 5) admin_actions
-- ---------------------------------------------------------------------------
-- Canonical migration currently defines:
--   - "Service role full access"
--   - "No direct user access" FOR ALL TO authenticated USING (false)
-- Replace this mixed policy set with a single explicit service-role-only policy.

alter table public.admin_actions enable row level security;

drop policy if exists "Service role full access"
  on public.admin_actions;
drop policy if exists "No direct user access"
  on public.admin_actions;
drop policy if exists admin_actions_service_role_all
  on public.admin_actions;

create policy admin_actions_service_role_all
  on public.admin_actions
  for all
  to service_role
  using (true)
  with check (true);

commit;

-- ---------------------------------------------------------------------------
-- 6) protected_spans (LIVE-ONLY GUARDED REPAIR)
-- ---------------------------------------------------------------------------
-- This table is part of the reported live defect family but is not represented in the
-- current repository migration chain. Keep the repair guarded and separate from the
-- canonical repo-backed tables.
--
-- begin;
--
-- do $$
-- begin
--   if to_regclass('public.protected_spans') is not null then
--     execute 'alter table public.protected_spans enable row level security';
--     execute 'drop policy if exists "Service role full access" on public.protected_spans';
--     execute 'drop policy if exists protected_spans_service_role_all on public.protected_spans';
--     execute ''create policy protected_spans_service_role_all on public.protected_spans for all to service_role using (true) with check (true)'';
--   else
--     raise notice ''Skipping protected_spans repair because public.protected_spans does not exist.'';
--   end if;
-- end
-- $$;
--
-- commit;
