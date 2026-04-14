-- RLS Fix Migration: Enable RLS + add policies for unprotected tables
-- Generated: 2025-06-14
-- Tables: evaluation_provider_calls, revision_events, governance_logs,
--         wave_execution_attempts, admin_actions, protected_spans, jobs
--
-- IMPORTANT:
-- - Production live state was corrected on 2026-04-02 via partial manual SQL Editor apply.
--   That means security posture is now correct in production, but migration lineage must still
--   be reconciled across environments and deployment history.
-- - This file is intentionally written to be safe for reconciliation use: RLS enablement is
--   idempotent, policy drops use IF EXISTS, and live-only tables are guarded with to_regclass.
-- - Apply this tracked migration in non-production environments instead of repeating manual SQL.
-- - `revision_events` does NOT have a `user_id` column in the canonical schema.
-- - `wave_execution_attempts` currently has an in-repo SELECT policy that depends on
--   revision_sessions.user_id, which is not present in the canonical revision_sessions schema.
-- - `admin_actions`, `governance_logs`, `wave_execution_attempts`, and `protected_spans`
--   are internal/system tables and should follow a service-role-only posture.
-- - Current runtime usage for `evaluation_provider_calls`, `revision_events`, and
--   `governance_logs`
--   is service/admin write paths, not end-user direct reads.
-- - Therefore this migration applies the conservative internal-table posture:
--   service-role-only access.
-- - If product requirements later need end-user reads, add a separate migration using
--   ownership derived through evaluation_jobs.manuscript_id -> manuscripts.user_id.

begin;

-- 1. evaluation_provider_calls: Enable RLS + service-role-only
alter table public.evaluation_provider_calls enable row level security;

drop policy if exists evaluation_provider_calls_service_role_all
	on public.evaluation_provider_calls;

create policy evaluation_provider_calls_service_role_all
	on public.evaluation_provider_calls
	for all
	to service_role
	using (true)
	with check (true);

-- 2. revision_events: Enable RLS + service-role-only
alter table public.revision_events enable row level security;

drop policy if exists revision_events_service_role_all
	on public.revision_events;

create policy revision_events_service_role_all
	on public.revision_events
	for all
	to service_role
	using (true)
	with check (true);

-- 3. jobs: Add service-role-only policy if the live table exists.
-- `public.jobs` is part of the audit report but is not represented in the canonical
-- migration chain in this repository. Guard this policy creation so clean environments
-- without that table do not fail the whole migration.
do $$
begin
	if to_regclass('public.jobs') is not null then
		execute 'drop policy if exists jobs_service_role_all on public.jobs';
		execute 'create policy jobs_service_role_all on public.jobs for all to service_role using (true) with check (true)';
	else
		raise notice ''Skipping jobs policy creation because public.jobs does not exist in this environment.'';
	end if;
end
$$;

-- 4. governance_logs: RLS is reportedly enabled live, but an existing policy may have
-- been attached to PUBLIC instead of service_role. Replace it with the intended
-- internal-table posture. Guard creation so clean environments without the table do not fail.
do $$
begin
	if to_regclass('public.governance_logs') is not null then
		execute 'alter table public.governance_logs enable row level security';
		execute 'drop policy if exists "Service role full access" on public.governance_logs';
		execute 'drop policy if exists governance_logs_service_role_all on public.governance_logs';
		execute ''create policy governance_logs_service_role_all on public.governance_logs for all to service_role using (true) with check (true)'';
	else
		raise notice ''Skipping governance_logs policy repair because public.governance_logs does not exist in this environment.'';
	end if;
end
$$;

-- 5. wave_execution_attempts: canonical repo policy currently assumes revision_sessions.user_id,
-- which does not exist in the repo schema. Replace all existing policies with service-role-only.
do $$
begin
	if to_regclass('public.wave_execution_attempts') is not null then
		execute 'alter table public.wave_execution_attempts enable row level security';
		execute 'drop policy if exists "Users can view own wave attempts" on public.wave_execution_attempts';
		execute 'drop policy if exists "Service role can manage wave attempts" on public.wave_execution_attempts';
		execute 'drop policy if exists wave_execution_attempts_service_role_all on public.wave_execution_attempts';
		execute ''create policy wave_execution_attempts_service_role_all on public.wave_execution_attempts for all to service_role using (true) with check (true)'';
	else
		raise notice ''Skipping wave_execution_attempts policy repair because public.wave_execution_attempts does not exist in this environment.'';
	end if;
end
$$;

-- 6. admin_actions: current canonical migration includes a misleading service-role policy
-- plus an authenticated deny-all policy. Replace the policy set with a single explicit
-- service-role-only policy.
do $$
begin
	if to_regclass('public.admin_actions') is not null then
		execute 'alter table public.admin_actions enable row level security';
		execute 'drop policy if exists "Service role full access" on public.admin_actions';
		execute 'drop policy if exists "No direct user access" on public.admin_actions';
		execute 'drop policy if exists admin_actions_service_role_all on public.admin_actions';
		execute ''create policy admin_actions_service_role_all on public.admin_actions for all to service_role using (true) with check (true)'';
	else
		raise notice ''Skipping admin_actions policy repair because public.admin_actions does not exist in this environment.'';
	end if;
end
$$;

-- 7. protected_spans: reported as an internal/system table in the live audit. The table is
-- not represented in this repository's migration chain, so only perform a guarded policy-target
-- repair if it exists live.
do $$
begin
	if to_regclass('public.protected_spans') is not null then
		execute 'alter table public.protected_spans enable row level security';
		execute 'drop policy if exists "Service role full access" on public.protected_spans';
		execute 'drop policy if exists protected_spans_service_role_all on public.protected_spans';
		execute ''create policy protected_spans_service_role_all on public.protected_spans for all to service_role using (true) with check (true)'';
	else
		raise notice ''Skipping protected_spans policy repair because public.protected_spans does not exist in this environment.'';
	end if;
end
$$;

commit;
