# Supabase Audit Reconciliation Plan (2026-04-01)

## Purpose

This document is a **read-only planning artifact** for the next Supabase tranche.
It captures the verified repository evidence, the now-resolved live-database answers, and **review-only SQL skeletons** for canonicalization work.

This file does **not** authorize direct database mutation. It is intended to be reviewed before any SQL is applied in Supabase.

## Current assessment

The repository and live-environment evidence confirm three distinct problems:

1. **RLS gaps on 3 tables created by migrations**
   - `public.evaluation_provider_calls`
   - `public.revision_events`
   - `public.governance_logs`
2. **Ghost tables referenced in code but missing from the migration chain**
   - `public.job_costs`
   - `public.worker_lifecycle_events`
3. **No generated database type contract**
   - no checked-in `database.types.*`
   - no type-generation script in `package.json`
   - at least one Supabase-specific `@ts-ignore` in `workers/phase2Worker.ts`

## Live database resolution (verified outside the repository)

### Ghost tables: resolved

Both ghost tables are now confirmed as **absent + dead code**:

- `public.job_costs`
  - live result: **does not exist**
  - dashboard outcome: **No results found**
  - disposition: code in `lib/jobs/cost.ts` is not backed by a live production table
- `public.worker_lifecycle_events`
  - live result: **does not exist**
  - dashboard outcome: **No results found**
  - disposition: code in `lib/observability/lifecycle-logger.ts` is not backed by a live production table

### Live RLS status snapshot

- `evaluation_provider_calls`
  - live dashboard status: **UNRESTRICTED**
  - implication: canonical RLS patch is required
- `revision_events`
  - live dashboard status: **UNRESTRICTED**
  - implication: canonical RLS patch is required
- `governance_logs`
  - live dashboard status: lock icon present, **no UNRESTRICTED badge**
  - implication: RLS is reportedly enabled live, but the effective policy target is defective if granted to `public` instead of `service_role`

### Additional internal-table defect family

The same policy-target bug may affect other internal/system tables.

- `wave_execution_attempts`
  - repo evidence: current migration defines a user SELECT policy that depends on `revision_sessions.user_id`
  - canonical repo evidence: `revision_sessions` does **not** have a `user_id` column in the canonical migration chain
  - safest current posture: service-role-only until a reviewed user-facing read requirement exists
- `admin_actions`
  - repo evidence: canonical migration defines:
    - `"Service role full access"`
    - `"No direct user access" FOR ALL TO authenticated USING (false)`
  - recommendation: replace the mixed policy set with one explicit `TO service_role` policy
- `protected_spans`
  - reported in live audit as an internal/service table with the same likely defect family
  - repo evidence: no canonical migration surfaced in this branch
  - recommendation: include only a **guarded repair block** in review SQL until the repo has a canonical definition

## Verified repository evidence

### RLS gaps

#### `evaluation_provider_calls`

- Created by: `supabase/migrations/20260128000003_add_evaluation_provider_calls.sql`
- Follow-up constraint migration: `supabase/migrations/20260128000004_add_provider_calls_idempotency.sql`
- Evidence: table creation, indexes, comments present; no `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`; no policies present in the migration chain.
- Runtime usage:
  - `workers/phase2Worker.ts`
  - tests and docs reference the table extensively

#### `revision_events`

- Created by: `supabase/migrations/20260317010000_add_revision_events.sql`
- Follow-up column/index migration: `supabase/migrations/20260319000000_add_revisedtext_and_changes_columns.sql`
- Evidence: table creation and indexes present; no RLS enablement; no policies present in the migration chain.
- Runtime usage:
  - `lib/revision/logRevisionEvent.ts`
  - `scripts/revision-stage2-smoke.mjs`

#### `governance_logs`

- Created by: `supabase/migrations/20260319010000_add_governance_logs.sql`
- Evidence: table creation and indexes present; no RLS enablement; no policies present in the migration chain.
- Runtime usage:
  - `lib/revision/persistence/log-governance-event.ts`

### Ghost tables

#### `job_costs`

- Referenced in: `lib/jobs/cost.ts`
- Operations present in code:
  - insert (`recordCost`)
  - per-job read (`getJobCostSummary`)
  - system snapshot (`getCostSnapshot`)
  - model breakdown (`getModelCostBreakdown`)
- Migration evidence: no migration references found under `supabase/migrations/`
- Live verdict: **absent + dead code**

#### `worker_lifecycle_events`

- Referenced in: `lib/observability/lifecycle-logger.ts`
- Operations present in code:
  - insert-only logging via `logLifecycleEvent`
- Migration evidence: no migration references found under `supabase/migrations/`
- Live verdict: **absent + dead code**

### Database typing gap

- No generated database types file found in the repository.
- No `supabase gen types` script found in `package.json`.
- `workers/phase2Worker.ts` contains:
  - `// @ts-ignore - upsert not in types but supported by Supabase`
- Current symptom: schema drift is not surfaced as a compile-time contract.

## Important ownership note

The policy examples below should **not** assume `evaluation_jobs.user_id` exists.

Current ownership evidence in this repository points to the chain:

- `evaluation_jobs.manuscript_id -> manuscripts.id -> manuscripts.user_id`

Additional revision-owned chains flow through:

- `revision_events.revision_session_id -> revision_sessions.evaluation_run_id -> evaluation_jobs.manuscript_id -> manuscripts.user_id`
- `governance_logs.session_id -> revision_sessions.evaluation_run_id -> evaluation_jobs.manuscript_id -> manuscripts.user_id`

That means authenticated-user read policies must derive ownership through `manuscripts.user_id` unless and until the canonical schema adds a direct job owner column.

## Resolved live-database question

The live existence question for the ghost tables is now resolved:

- `public.job_costs`: **absent**
- `public.worker_lifecycle_events`: **absent**

Because both tables are absent and currently unsupported in production, the recommended path is to avoid creating them preemptively and instead treat their code paths as unconfigured/dead until a real product requirement exists.

## Remaining live verification SQL

The remaining live verification work is now a **defect-family preflight**, not just a single-table check.

Verify exact RLS state:

```sql
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'governance_logs';
```

Inspect any live policies:

```sql
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
  and tablename = 'governance_logs'
order by policyname;
```

Repeat the policy inspection for the sibling internal tables:

```sql
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
    'governance_logs',
    'wave_execution_attempts',
    'admin_actions',
    'protected_spans'
  )
order by tablename, policyname;
```

For audit completeness, the broader reference queries remain useful:

```sql
select
  table_schema,
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('job_costs', 'worker_lifecycle_events')
order by table_name;
```

```sql
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('job_costs', 'worker_lifecycle_events')
order by table_name, ordinal_position;
```

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('job_costs', 'worker_lifecycle_events')
order by tablename, indexname;
```

```sql
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
    'governance_logs'
  )
order by c.relname;
```

```sql
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
    'governance_logs'
  )
order by tablename, policyname;
```

## Ghost table decision matrix

| Live DB result | Meaning | Recommended next action |
| --- | --- | --- |
| Table exists and shape matches code expectations | Table was created outside the migration chain | Add a **backfill/baseline migration** to capture canonical DDL and any missing indexes/RLS/comments. Make production a no-op where possible, but ensure clean environments create the table correctly. |
| Table exists but shape differs from code expectations | Drift already exists in production | Write a **reconciliation migration** after capturing the live shape. Do not guess the schema from code alone. |
| Table does not exist and code path is still needed | Missing canonical schema | Write a **new canonical create-table migration**, then add RLS and type support. |
| Table does not exist and code path is obsolete | Dead code / stale abstraction | Remove or gate the code references instead of creating a table solely to satisfy drift. |

## Resolved ghost table outcome

The live result places **both** ghost tables in the fourth matrix row: **table absent + code path obsolete**.

Recommended branch-only follow-up:

- `lib/jobs/cost.ts`
  - convert from assumed-backed persistence to explicit "table not configured" behavior when invoked
  - use fail-safe logging and avoid pretending cost persistence is live
- `lib/observability/lifecycle-logger.ts`
  - convert to explicit no-op / warning behavior when the table is not configured
  - keep the helper non-throwing

This is a code-governance cleanup task, not a Supabase schema task.

## Internal-table RLS correction tranche

At this point the branch should treat the following as one defect family:

- wrong policy target (`public` instead of `service_role`)
- misleading policy names that imply service-role-only while granting broader access
- internal/system tables that should not currently expose user-scoped reads

The consolidated correction tranche should cover:

1. `evaluation_provider_calls`
2. `revision_events`
3. `governance_logs`
4. `wave_execution_attempts`
5. `admin_actions`
6. `protected_spans` (guarded live-only repair until canonical repo definition exists)

## Unapplied SQL skeletons

These are review starters only. They are intentionally conservative and should be refined after the final live policy readback for the internal-table defect family.

### 1) RLS patch skeleton for `evaluation_provider_calls`

```sql
begin;

alter table public.evaluation_provider_calls enable row level security;

drop policy if exists evaluation_provider_calls_service_role_all on public.evaluation_provider_calls;
drop policy if exists evaluation_provider_calls_authenticated_select_own on public.evaluation_provider_calls;

create policy evaluation_provider_calls_service_role_all
  on public.evaluation_provider_calls
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy evaluation_provider_calls_authenticated_select_own
  on public.evaluation_provider_calls
  for select
  using (
    exists (
      select 1
      from public.evaluation_jobs ej
      join public.manuscripts m
        on m.id = ej.manuscript_id
      where ej.id = evaluation_provider_calls.job_id
        and m.user_id = auth.uid()
    )
  );

commit;
```

### 2) RLS patch skeleton for `revision_events`

```sql
begin;

alter table public.revision_events enable row level security;

drop policy if exists revision_events_service_role_all on public.revision_events;
drop policy if exists revision_events_authenticated_select_own on public.revision_events;

create policy revision_events_service_role_all
  on public.revision_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy revision_events_authenticated_select_own
  on public.revision_events
  for select
  using (
    exists (
      select 1
      from public.revision_sessions rs
      join public.evaluation_jobs ej
        on ej.id = rs.evaluation_run_id
      join public.manuscripts m
        on m.id = ej.manuscript_id
      where rs.id = revision_events.revision_session_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.evaluation_jobs ej
      join public.manuscripts m
        on m.id = ej.manuscript_id
      where ej.id = revision_events.evaluation_run_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.manuscripts m
      where m.id = revision_events.manuscript_id
        and m.user_id = auth.uid()
    )
  );

commit;
```

### 3) RLS patch skeleton for `governance_logs`

```sql
begin;

alter table public.governance_logs enable row level security;

drop policy if exists governance_logs_service_role_all on public.governance_logs;
drop policy if exists governance_logs_authenticated_select_own on public.governance_logs;

create policy governance_logs_service_role_all
  on public.governance_logs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy governance_logs_authenticated_select_own
  on public.governance_logs
  for select
  using (
    exists (
      select 1
      from public.revision_sessions rs
      join public.evaluation_jobs ej
        on ej.id = rs.evaluation_run_id
      join public.manuscripts m
        on m.id = ej.manuscript_id
      where rs.id = governance_logs.session_id
        and m.user_id = auth.uid()
    )
  );

commit;
```

### 4) Ghost-table baseline skeleton for `job_costs` (retained for archive only — not recommended now)

```sql
begin;

create table if not exists public.job_costs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.evaluation_jobs(id) on delete cascade,
  phase text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cost_cents integer not null default 0,
  called_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_costs_job_id
  on public.job_costs(job_id);

create index if not exists idx_job_costs_called_at
  on public.job_costs(called_at desc);

create index if not exists idx_job_costs_model
  on public.job_costs(model);

alter table public.job_costs enable row level security;

drop policy if exists job_costs_service_role_all on public.job_costs;
drop policy if exists job_costs_authenticated_select_own on public.job_costs;

create policy job_costs_service_role_all
  on public.job_costs
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy job_costs_authenticated_select_own
  on public.job_costs
  for select
  using (
    exists (
      select 1
      from public.evaluation_jobs ej
      join public.manuscripts m
        on m.id = ej.manuscript_id
      where ej.id = job_costs.job_id
        and m.user_id = auth.uid()
    )
  );

commit;
```

### 5) Ghost-table baseline skeleton for `worker_lifecycle_events` (retained for archive only — not recommended now)

```sql
begin;

create table if not exists public.worker_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.evaluation_jobs(id) on delete cascade,
  event_type text not null,
  message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_worker_lifecycle_events_job_id
  on public.worker_lifecycle_events(job_id);

create index if not exists idx_worker_lifecycle_events_created_at
  on public.worker_lifecycle_events(created_at desc);

alter table public.worker_lifecycle_events enable row level security;

drop policy if exists worker_lifecycle_events_service_role_all on public.worker_lifecycle_events;
drop policy if exists worker_lifecycle_events_authenticated_select_own on public.worker_lifecycle_events;

create policy worker_lifecycle_events_service_role_all
  on public.worker_lifecycle_events
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy worker_lifecycle_events_authenticated_select_own
  on public.worker_lifecycle_events
  for select
  using (
    exists (
      select 1
      from public.evaluation_jobs ej
      join public.manuscripts m
        on m.id = ej.manuscript_id
      where ej.id = worker_lifecycle_events.job_id
        and m.user_id = auth.uid()
    )
  );

commit;
```

## Database types rollout checklist

### Phase 0: decide the canonical file location

Recommended target:

- `types/database.types.ts`

Alternative acceptable location if already standard elsewhere:

- `lib/supabase/database.types.ts`

Pick one and keep it stable.

### Phase 1: add generation command

Add a script to `package.json` after confirming the team-preferred project-ref workflow. Example shape:

```json
{
  "scripts": {
    "db:types:gen": "supabase gen types typescript --project-id <PROJECT_REF> --schema public > types/database.types.ts"
  }
}
```

If shell redirection portability is a concern, wrap it in a small Node or bash script under `scripts/`.

### Phase 2: wire the generated types into clients

- Update shared Supabase client factories to use `SupabaseClient<Database>`.
- Prefer a single exported `Database` type contract instead of ad hoc row shapes.
- Keep service/admin clients and browser/server clients on the same generated contract.

### Phase 3: remove known escape hatches

- Eliminate the `@ts-ignore` in `workers/phase2Worker.ts`.
- Replace loosely typed `.from("...")` usage with generated table-aware types.
- Use `Tables<...>` helpers if you standardize them, but keep the generated file as the source of truth.

### Phase 4: adopt incrementally on highest-risk surfaces first

Suggested order:

1. `workers/phase2Worker.ts`
2. `lib/revision/logRevisionEvent.ts`
3. `lib/revision/persistence/log-governance-event.ts`
4. remaining live Supabase write paths

### Phase 5: add drift detection to workflow

At minimum:

- regenerate types whenever a migration changes schema
- fail review if schema-affecting work lands without regenerated types
- document the generation command in the contributor workflow

## Recommended execution order after live check

1. Record the ghost-table resolution as **absent + dead code** for both `job_costs` and `worker_lifecycle_events`.
2. Draft branch-only dead-code handling for `lib/jobs/cost.ts` and `lib/observability/lifecycle-logger.ts`.
3. Draft final review SQL for the internal-table RLS correction tranche.
4. Verify live policy targets for `governance_logs`, `wave_execution_attempts`, `admin_actions`, and `protected_spans` and confirm whether any are currently granted to `public` or `authenticated` instead of `service_role`.
5. Generate and check in database types.
6. Remove Supabase typing escape hatches on live-backed tables.
7. Run post-change verification:
   - migration dry review
   - policy inventory review
   - typed compile pass
   - targeted runtime smoke checks

## Stop conditions

Do **not** apply final migration SQL until the following are true:

- the ghost-table outcome is explicitly recorded as **absent + dead code** (now satisfied)
- the exact live policy targets for the internal-table defect family are verified in SQL
- reviewed migration SQL exists for the tables that truly require canonicalization

Anything else is guess-driven database work, which is how future archaeology careers are accidentally funded.

## Review outcome needed

The live DB check has already answered the ghost-table questions:

1. `job_costs` does **not** exist in the target Supabase project.
2. `worker_lifecycle_events` does **not** exist in the target Supabase project.

The remaining open review question set is:

3. Which of `governance_logs`, `wave_execution_attempts`, `admin_actions`, and `protected_spans` currently have misleading policies granted to `public` or `authenticated` instead of `service_role`?

Those answers determine the final shape of the consolidated internal-table RLS correction tranche.
