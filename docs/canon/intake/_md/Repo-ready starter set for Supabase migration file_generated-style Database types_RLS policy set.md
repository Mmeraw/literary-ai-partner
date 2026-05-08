**Repo-ready starter set for Supabase migration file\_generated-style Database types\_RLS policy set**

I’m assuming:

* server-side service role handles pipeline writes
* authenticated users can read their own project data
* ownership is tracked at the manuscript level with owner\_user\_id

If your repo already has a profiles or projects ownership model, swap that relation in the RLS predicates.

**supabase/migrations/20260322\_revisiongrade\_pipeline.sql**

-- =========================================================
-- REVISIONGRADE PIPELINE
-- Supabase migration
-- =========================================================

begin;

-- ---------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------

do $$
begin
 if not exists (select 1 from pg\_type where typname = 'pipeline\_state') then
 create type public.pipeline\_state as enum (
 'draft',
 'pass1\_complete',
 'pass2\_complete',
 'converged',
 'wave\_eligible',
 'wave\_executed',
 'revised\_output',
 'validated',
 'rejected'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'execution\_mode') then
 create type public.execution\_mode as enum (
 'trusted\_path',
 'studio'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'pass\_status') then
 create type public.pass\_status as enum (
 'not\_started',
 'in\_progress',
 'complete',
 'failed',
 'invalid'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'governance\_decision') then
 create type public.governance\_decision as enum (
 'allow',
 'block',
 'reject',
 'require\_revision'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'criterion\_judgment') then
 create type public.criterion\_judgment as enum (
 'effective',
 'ineffective',
 'mixed'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'divergence\_status') then
 create type public.divergence\_status as enum (
 'confirms',
 'challenges',
 'expands'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'agreement\_status') then
 create type public.agreement\_status as enum (
 'agreement',
 'partial\_agreement',
 'disagreement'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'priority\_level') then
 create type public.priority\_level as enum (
 'high',
 'medium',
 'low'
 );
 end if;

 if not exists (select 1 from pg\_type where typname = 'artifact\_type') then
 create type public.artifact\_type as enum (
 'pass\_output',
 'wave\_output',
 'validation\_output',
 'governance\_log',
 'audit\_bundle',
 'manifest',
 'source\_snapshot',
 'normalized\_snapshot'
 );
 end if;
end $$;

-- ---------------------------------------------------------
-- UPDATED\_AT HELPER
-- ---------------------------------------------------------

create or replace function public.set\_updated\_at()
returns trigger
language plpgsql
as $$
begin
 new.updated\_at = now();
 return new;
end;
$$;

-- ---------------------------------------------------------
-- TRANSITION VALIDATOR
-- ---------------------------------------------------------

create or replace function public.is\_valid\_pipeline\_transition(
 from\_state public.pipeline\_state,
 to\_state public.pipeline\_state
)
returns boolean
language sql
immutable
as $$
 select case
 when from\_state = 'draft' and to\_state in ('pass1\_complete', 'rejected') then true
 when from\_state = 'pass1\_complete' and to\_state in ('pass2\_complete', 'rejected') then true
 when from\_state = 'pass2\_complete' and to\_state in ('converged', 'rejected') then true
 when from\_state = 'converged' and to\_state in ('wave\_eligible', 'rejected') then true
 when from\_state = 'wave\_eligible' and to\_state in ('wave\_executed', 'rejected') then true
 when from\_state = 'wave\_executed' and to\_state in ('revised\_output', 'rejected') then true
 when from\_state = 'revised\_output' and to\_state in ('validated', 'rejected') then true
 else false
 end;
$$;

-- ---------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------

create table if not exists public.manuscripts (
 id uuid primary key default gen\_random\_uuid(),
 owner\_user\_id uuid not null references auth.users(id) on delete cascade,
 manuscript\_code text not null unique,
 title text not null,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now()
);

create table if not exists public.chapters (
 id uuid primary key default gen\_random\_uuid(),
 manuscript\_id uuid not null references public.manuscripts(id) on delete cascade,
 chapter\_code text not null,
 chapter\_number integer,
 title text,
 raw\_text text,
 normalized\_text text,
 source\_hash text,
 normalized\_hash text,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now(),
 unique (manuscript\_id, chapter\_code)
);

create table if not exists public.pipeline\_runs (
 id uuid primary key default gen\_random\_uuid(),
 manuscript\_id uuid not null references public.manuscripts(id) on delete cascade,
 chapter\_id uuid not null references public.chapters(id) on delete cascade,
 execution\_mode public.execution\_mode not null default 'trusted\_path',
 current\_state public.pipeline\_state not null default 'draft',
 blocked boolean not null default false,
 rejection\_reason text,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now(),
 completed\_at timestamptz
);

create table if not exists public.pipeline\_state\_history (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references public.pipeline\_runs(id) on delete cascade,
 from\_state public.pipeline\_state,
 to\_state public.pipeline\_state not null,
 action text not null,
 actor text not null default 'system',
 reason text,
 created\_at timestamptz not null default now()
);

create table if not exists public.pass\_runs (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references public.pipeline\_runs(id) on delete cascade,
 pass\_number integer not null check (pass\_number in (1,2,3)),
 status public.pass\_status not null default 'not\_started',
 checklist\_passed boolean,
 completed boolean not null default false,
 started\_at timestamptz,
 completed\_at timestamptz,
 summary\_primary\_strength text,
 summary\_primary\_weakness text,
 summary\_dominant\_pattern text,
 summary\_divergence text,
 summary\_convergence text,
 notes text,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now(),
 unique (pipeline\_run\_id, pass\_number)
);

create table if not exists public.pass\_criterion\_results (
 id uuid primary key default gen\_random\_uuid(),
 pass\_run\_id uuid not null references public.pass\_runs(id) on delete cascade,
 criterion\_name text not null,
 finding text not null,
 impact text not null,
 judgment public.criterion\_judgment not null,
 divergence\_status public.divergence\_status,
 agreement\_status public.agreement\_status,
 resolution\_logic text,
 pass1\_summary text,
 pass2\_summary text,
 conflict\_description text,
 created\_at timestamptz not null default now()
);

create table if not exists public.pass\_criterion\_evidence (
 id uuid primary key default gen\_random\_uuid(),
 criterion\_result\_id uuid not null references public.pass\_criterion\_results(id) on delete cascade,
 evidence\_text text not null,
 evidence\_order integer not null default 1,
 created\_at timestamptz not null default now()
);

create table if not exists public.wave\_executions (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null unique references public.pipeline\_runs(id) on delete cascade,
 eligible boolean not null default false,
 invocation\_valid boolean not null default false,
 invoked boolean not null default false,
 completed boolean not null default false,
 notes text,
 started\_at timestamptz,
 completed\_at timestamptz,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now()
);

create table if not exists public.wave\_runs (
 id uuid primary key default gen\_random\_uuid(),
 wave\_execution\_id uuid not null references public.wave\_executions(id) on delete cascade,
 wave\_number integer not null check (wave\_number between 1 and 62),
 execution\_order integer not null,
 completed boolean not null default false,
 notes text,
 created\_at timestamptz not null default now(),
 unique (wave\_execution\_id, wave\_number)
);

create table if not exists public.wave\_revision\_targets (
 id uuid primary key default gen\_random\_uuid(),
 wave\_execution\_id uuid not null references public.wave\_executions(id) on delete cascade,
 zone text not null,
 issue\_type text not null,
 recommended\_wave integer not null check (recommended\_wave between 1 and 62),
 priority public.priority\_level not null,
 directive text,
 created\_at timestamptz not null default now()
);

create table if not exists public.validation\_runs (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null unique references public.pipeline\_runs(id) on delete cascade,
 checklist\_version text not null,
 all\_checks\_passed boolean not null default false,
 validated\_at timestamptz,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now()
);

create table if not exists public.validation\_check\_results (
 id uuid primary key default gen\_random\_uuid(),
 validation\_run\_id uuid not null references public.validation\_runs(id) on delete cascade,
 check\_code text not null,
 passed boolean not null,
 notes text,
 created\_at timestamptz not null default now(),
 unique (validation\_run\_id, check\_code)
);

create table if not exists public.governance\_logs (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references public.pipeline\_runs(id) on delete cascade,
 decision public.governance\_decision not null,
 blocked boolean not null default false,
 reason text,
 metadata jsonb not null default '{}'::jsonb,
 created\_at timestamptz not null default now()
);

create table if not exists public.artifacts (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references public.pipeline\_runs(id) on delete cascade,
 artifact\_type public.artifact\_type not null,
 artifact\_key text not null,
 storage\_path text,
 manifest jsonb not null default '{}'::jsonb,
 created\_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------

create index if not exists idx\_manuscripts\_owner\_user\_id
 on public.manuscripts(owner\_user\_id);

create index if not exists idx\_chapters\_manuscript\_id
 on public.chapters(manuscript\_id);

create index if not exists idx\_pipeline\_runs\_manuscript\_id
 on public.pipeline\_runs(manuscript\_id);

create index if not exists idx\_pipeline\_runs\_chapter\_id
 on public.pipeline\_runs(chapter\_id);

create index if not exists idx\_pipeline\_runs\_current\_state
 on public.pipeline\_runs(current\_state);

create index if not exists idx\_pipeline\_state\_history\_run\_id
 on public.pipeline\_state\_history(pipeline\_run\_id);

create index if not exists idx\_pass\_runs\_pipeline\_run\_id
 on public.pass\_runs(pipeline\_run\_id);

create index if not exists idx\_pass\_criterion\_results\_pass\_run\_id
 on public.pass\_criterion\_results(pass\_run\_id);

create index if not exists idx\_pass\_criterion\_evidence\_result\_id
 on public.pass\_criterion\_evidence(criterion\_result\_id);

create index if not exists idx\_wave\_runs\_execution\_id
 on public.wave\_runs(wave\_execution\_id);

create index if not exists idx\_wave\_revision\_targets\_execution\_id
 on public.wave\_revision\_targets(wave\_execution\_id);

create index if not exists idx\_validation\_check\_results\_run\_id
 on public.validation\_check\_results(validation\_run\_id);

create index if not exists idx\_governance\_logs\_run\_id
 on public.governance\_logs(pipeline\_run\_id);

create index if not exists idx\_artifacts\_run\_id
 on public.artifacts(pipeline\_run\_id);

-- ---------------------------------------------------------
-- UPDATED\_AT TRIGGERS
-- ---------------------------------------------------------

drop trigger if exists trg\_manuscripts\_updated\_at on public.manuscripts;
create trigger trg\_manuscripts\_updated\_at
before update on public.manuscripts
for each row execute function public.set\_updated\_at();

drop trigger if exists trg\_chapters\_updated\_at on public.chapters;
create trigger trg\_chapters\_updated\_at
before update on public.chapters
for each row execute function public.set\_updated\_at();

drop trigger if exists trg\_pipeline\_runs\_updated\_at on public.pipeline\_runs;
create trigger trg\_pipeline\_runs\_updated\_at
before update on public.pipeline\_runs
for each row execute function public.set\_updated\_at();

drop trigger if exists trg\_pass\_runs\_updated\_at on public.pass\_runs;
create trigger trg\_pass\_runs\_updated\_at
before update on public.pass\_runs
for each row execute function public.set\_updated\_at();

drop trigger if exists trg\_wave\_executions\_updated\_at on public.wave\_executions;
create trigger trg\_wave\_executions\_updated\_at
before update on public.wave\_executions
for each row execute function public.set\_updated\_at();

drop trigger if exists trg\_validation\_runs\_updated\_at on public.validation\_runs;
create trigger trg\_validation\_runs\_updated\_at
before update on public.validation\_runs
for each row execute function public.set\_updated\_at();

-- ---------------------------------------------------------
-- STATE TRANSITION ENFORCEMENT
-- ---------------------------------------------------------

create or replace function public.enforce\_pipeline\_state\_transition()
returns trigger
language plpgsql
as $$
begin
 if old.current\_state is distinct from new.current\_state then
 if not public.is\_valid\_pipeline\_transition(old.current\_state, new.current\_state) then
 raise exception 'Invalid pipeline state transition: % -> %', old.current\_state, new.current\_state;
 end if;
 end if;
 return new;
end;
$$;

drop trigger if exists trg\_pipeline\_runs\_state\_transition on public.pipeline\_runs;
create trigger trg\_pipeline\_runs\_state\_transition
before update on public.pipeline\_runs
for each row execute function public.enforce\_pipeline\_state\_transition();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------

alter table public.manuscripts enable row level security;
alter table public.chapters enable row level security;
alter table public.pipeline\_runs enable row level security;
alter table public.pipeline\_state\_history enable row level security;
alter table public.pass\_runs enable row level security;
alter table public.pass\_criterion\_results enable row level security;
alter table public.pass\_criterion\_evidence enable row level security;
alter table public.wave\_executions enable row level security;
alter table public.wave\_runs enable row level security;
alter table public.wave\_revision\_targets enable row level security;
alter table public.validation\_runs enable row level security;
alter table public.validation\_check\_results enable row level security;
alter table public.governance\_logs enable row level security;
alter table public.artifacts enable row level security;

-- ---------------------------------------------------------
-- HELPER PREDICATES
-- ---------------------------------------------------------

create or replace function public.user\_owns\_manuscript(target\_manuscript\_id uuid)
returns boolean
language sql
stable
as $$
 select exists (
 select 1
 from public.manuscripts m
 where m.id = target\_manuscript\_id
 and m.owner\_user\_id = auth.uid()
 );
$$;

create or replace function public.user\_owns\_pipeline\_run(target\_pipeline\_run\_id uuid)
returns boolean
language sql
stable
as $$
 select exists (
 select 1
 from public.pipeline\_runs pr
 join public.manuscripts m on m.id = pr.manuscript\_id
 where pr.id = target\_pipeline\_run\_id
 and m.owner\_user\_id = auth.uid()
 );
$$;

-- ---------------------------------------------------------
-- MANUSCRIPTS POLICIES
-- ---------------------------------------------------------

drop policy if exists manuscripts\_select\_own on public.manuscripts;
create policy manuscripts\_select\_own
on public.manuscripts
for select
to authenticated
using (owner\_user\_id = auth.uid());

drop policy if exists manuscripts\_insert\_own on public.manuscripts;
create policy manuscripts\_insert\_own
on public.manuscripts
for insert
to authenticated
with check (owner\_user\_id = auth.uid());

drop policy if exists manuscripts\_update\_own on public.manuscripts;
create policy manuscripts\_update\_own
on public.manuscripts
for update
to authenticated
using (owner\_user\_id = auth.uid())
with check (owner\_user\_id = auth.uid());

drop policy if exists manuscripts\_delete\_own on public.manuscripts;
create policy manuscripts\_delete\_own
on public.manuscripts
for delete
to authenticated
using (owner\_user\_id = auth.uid());

-- ---------------------------------------------------------
-- CHAPTERS POLICIES
-- ---------------------------------------------------------

drop policy if exists chapters\_select\_own on public.chapters;
create policy chapters\_select\_own
on public.chapters
for select
to authenticated
using (
 exists (
 select 1
 from public.manuscripts m
 where m.id = manuscript\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists chapters\_insert\_own on public.chapters;
create policy chapters\_insert\_own
on public.chapters
for insert
to authenticated
with check (
 exists (
 select 1
 from public.manuscripts m
 where m.id = manuscript\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists chapters\_update\_own on public.chapters;
create policy chapters\_update\_own
on public.chapters
for update
to authenticated
using (
 exists (
 select 1
 from public.manuscripts m
 where m.id = manuscript\_id
 and m.owner\_user\_id = auth.uid()
 )
)
with check (
 exists (
 select 1
 from public.manuscripts m
 where m.id = manuscript\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists chapters\_delete\_own on public.chapters;
create policy chapters\_delete\_own
on public.chapters
for delete
to authenticated
using (
 exists (
 select 1
 from public.manuscripts m
 where m.id = manuscript\_id
 and m.owner\_user\_id = auth.uid()
 )
);

-- ---------------------------------------------------------
-- PIPELINE CHILD TABLES
-- Read access for owners
-- Write access intentionally service-role only by default
-- ---------------------------------------------------------

drop policy if exists pipeline\_runs\_select\_own on public.pipeline\_runs;
create policy pipeline\_runs\_select\_own
on public.pipeline\_runs
for select
to authenticated
using (public.user\_owns\_manuscript(manuscript\_id));

drop policy if exists pipeline\_state\_history\_select\_own on public.pipeline\_state\_history;
create policy pipeline\_state\_history\_select\_own
on public.pipeline\_state\_history
for select
to authenticated
using (public.user\_owns\_pipeline\_run(pipeline\_run\_id));

drop policy if exists pass\_runs\_select\_own on public.pass\_runs;
create policy pass\_runs\_select\_own
on public.pass\_runs
for select
to authenticated
using (public.user\_owns\_pipeline\_run(pipeline\_run\_id));

drop policy if exists pass\_criterion\_results\_select\_own on public.pass\_criterion\_results;
create policy pass\_criterion\_results\_select\_own
on public.pass\_criterion\_results
for select
to authenticated
using (
 exists (
 select 1
 from public.pass\_runs pr
 join public.pipeline\_runs p on p.id = pr.pipeline\_run\_id
 join public.manuscripts m on m.id = p.manuscript\_id
 where pr.id = pass\_run\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists pass\_criterion\_evidence\_select\_own on public.pass\_criterion\_evidence;
create policy pass\_criterion\_evidence\_select\_own
on public.pass\_criterion\_evidence
for select
to authenticated
using (
 exists (
 select 1
 from public.pass\_criterion\_results pcr
 join public.pass\_runs pr on pr.id = pcr.pass\_run\_id
 join public.pipeline\_runs p on p.id = pr.pipeline\_run\_id
 join public.manuscripts m on m.id = p.manuscript\_id
 where pcr.id = criterion\_result\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists wave\_executions\_select\_own on public.wave\_executions;
create policy wave\_executions\_select\_own
on public.wave\_executions
for select
to authenticated
using (public.user\_owns\_pipeline\_run(pipeline\_run\_id));

drop policy if exists wave\_runs\_select\_own on public.wave\_runs;
create policy wave\_runs\_select\_own
on public.wave\_runs
for select
to authenticated
using (
 exists (
 select 1
 from public.wave\_executions we
 join public.pipeline\_runs p on p.id = we.pipeline\_run\_id
 join public.manuscripts m on m.id = p.manuscript\_id
 where we.id = wave\_execution\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists wave\_revision\_targets\_select\_own on public.wave\_revision\_targets;
create policy wave\_revision\_targets\_select\_own
on public.wave\_revision\_targets
for select
to authenticated
using (
 exists (
 select 1
 from public.wave\_executions we
 join public.pipeline\_runs p on p.id = we.pipeline\_run\_id
 join public.manuscripts m on m.id = p.manuscript\_id
 where we.id = wave\_execution\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists validation\_runs\_select\_own on public.validation\_runs;
create policy validation\_runs\_select\_own
on public.validation\_runs
for select
to authenticated
using (public.user\_owns\_pipeline\_run(pipeline\_run\_id));

drop policy if exists validation\_check\_results\_select\_own on public.validation\_check\_results;
create policy validation\_check\_results\_select\_own
on public.validation\_check\_results
for select
to authenticated
using (
 exists (
 select 1
 from public.validation\_runs vr
 join public.pipeline\_runs p on p.id = vr.pipeline\_run\_id
 join public.manuscripts m on m.id = p.manuscript\_id
 where vr.id = validation\_run\_id
 and m.owner\_user\_id = auth.uid()
 )
);

drop policy if exists governance\_logs\_select\_own on public.governance\_logs;
create policy governance\_logs\_select\_own
on public.governance\_logs
for select
to authenticated
using (public.user\_owns\_pipeline\_run(pipeline\_run\_id));

drop policy if exists artifacts\_select\_own on public.artifacts;
create policy artifacts\_select\_own
on public.artifacts
for select
to authenticated
using (public.user\_owns\_pipeline\_run(pipeline\_run\_id));

commit;

**src/types/database.ts**

export type Json =
 | string
 | number
 | boolean
 | null
 | { [key: string]: Json | undefined }
 | Json[];

export type Database = {
 public: {
 Tables: {
 manuscripts: {
 Row: {
 id: string;
 owner\_user\_id: string;
 manuscript\_code: string;
 title: string;
 created\_at: string;
 updated\_at: string;
 };
 Insert: {
 id?: string;
 owner\_user\_id: string;
 manuscript\_code: string;
 title: string;
 created\_at?: string;
 updated\_at?: string;
 };
 Update: {
 id?: string;
 owner\_user\_id?: string;
 manuscript\_code?: string;
 title?: string;
 created\_at?: string;
 updated\_at?: string;
 };
 Relationships: [];
 };
 chapters: {
 Row: {
 id: string;
 manuscript\_id: string;
 chapter\_code: string;
 chapter\_number: number | null;
 title: string | null;
 raw\_text: string | null;
 normalized\_text: string | null;
 source\_hash: string | null;
 normalized\_hash: string | null;
 created\_at: string;
 updated\_at: string;
 };
 Insert: {
 id?: string;
 manuscript\_id: string;
 chapter\_code: string;
 chapter\_number?: number | null;
 title?: string | null;
 raw\_text?: string | null;
 normalized\_text?: string | null;
 source\_hash?: string | null;
 normalized\_hash?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Update: {
 id?: string;
 manuscript\_id?: string;
 chapter\_code?: string;
 chapter\_number?: number | null;
 title?: string | null;
 raw\_text?: string | null;
 normalized\_text?: string | null;
 source\_hash?: string | null;
 normalized\_hash?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "chapters\_manuscript\_id\_fkey";
 columns: ["manuscript\_id"];
 referencedRelation: "manuscripts";
 referencedColumns: ["id"];
 }
 ];
 };
 pipeline\_runs: {
 Row: {
 id: string;
 manuscript\_id: string;
 chapter\_id: string;
 execution\_mode: Database["public"]["Enums"]["execution\_mode"];
 current\_state: Database["public"]["Enums"]["pipeline\_state"];
 blocked: boolean;
 rejection\_reason: string | null;
 created\_at: string;
 updated\_at: string;
 completed\_at: string | null;
 };
 Insert: {
 id?: string;
 manuscript\_id: string;
 chapter\_id: string;
 execution\_mode?: Database["public"]["Enums"]["execution\_mode"];
 current\_state?: Database["public"]["Enums"]["pipeline\_state"];
 blocked?: boolean;
 rejection\_reason?: string | null;
 created\_at?: string;
 updated\_at?: string;
 completed\_at?: string | null;
 };
 Update: {
 id?: string;
 manuscript\_id?: string;
 chapter\_id?: string;
 execution\_mode?: Database["public"]["Enums"]["execution\_mode"];
 current\_state?: Database["public"]["Enums"]["pipeline\_state"];
 blocked?: boolean;
 rejection\_reason?: string | null;
 created\_at?: string;
 updated\_at?: string;
 completed\_at?: string | null;
 };
 Relationships: [
 {
 foreignKeyName: "pipeline\_runs\_manuscript\_id\_fkey";
 columns: ["manuscript\_id"];
 referencedRelation: "manuscripts";
 referencedColumns: ["id"];
 },
 {
 foreignKeyName: "pipeline\_runs\_chapter\_id\_fkey";
 columns: ["chapter\_id"];
 referencedRelation: "chapters";
 referencedColumns: ["id"];
 }
 ];
 };
 pipeline\_state\_history: {
 Row: {
 id: string;
 pipeline\_run\_id: string;
 from\_state: Database["public"]["Enums"]["pipeline\_state"] | null;
 to\_state: Database["public"]["Enums"]["pipeline\_state"];
 action: string;
 actor: string;
 reason: string | null;
 created\_at: string;
 };
 Insert: {
 id?: string;
 pipeline\_run\_id: string;
 from\_state?: Database["public"]["Enums"]["pipeline\_state"] | null;
 to\_state: Database["public"]["Enums"]["pipeline\_state"];
 action: string;
 actor?: string;
 reason?: string | null;
 created\_at?: string;
 };
 Update: {
 id?: string;
 pipeline\_run\_id?: string;
 from\_state?: Database["public"]["Enums"]["pipeline\_state"] | null;
 to\_state?: Database["public"]["Enums"]["pipeline\_state"];
 action?: string;
 actor?: string;
 reason?: string | null;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "pipeline\_state\_history\_pipeline\_run\_id\_fkey";
 columns: ["pipeline\_run\_id"];
 referencedRelation: "pipeline\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 pass\_runs: {
 Row: {
 id: string;
 pipeline\_run\_id: string;
 pass\_number: number;
 status: Database["public"]["Enums"]["pass\_status"];
 checklist\_passed: boolean | null;
 completed: boolean;
 started\_at: string | null;
 completed\_at: string | null;
 summary\_primary\_strength: string | null;
 summary\_primary\_weakness: string | null;
 summary\_dominant\_pattern: string | null;
 summary\_divergence: string | null;
 summary\_convergence: string | null;
 notes: string | null;
 created\_at: string;
 updated\_at: string;
 };
 Insert: {
 id?: string;
 pipeline\_run\_id: string;
 pass\_number: number;
 status?: Database["public"]["Enums"]["pass\_status"];
 checklist\_passed?: boolean | null;
 completed?: boolean;
 started\_at?: string | null;
 completed\_at?: string | null;
 summary\_primary\_strength?: string | null;
 summary\_primary\_weakness?: string | null;
 summary\_dominant\_pattern?: string | null;
 summary\_divergence?: string | null;
 summary\_convergence?: string | null;
 notes?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Update: {
 id?: string;
 pipeline\_run\_id?: string;
 pass\_number?: number;
 status?: Database["public"]["Enums"]["pass\_status"];
 checklist\_passed?: boolean | null;
 completed?: boolean;
 started\_at?: string | null;
 completed\_at?: string | null;
 summary\_primary\_strength?: string | null;
 summary\_primary\_weakness?: string | null;
 summary\_dominant\_pattern?: string | null;
 summary\_divergence?: string | null;
 summary\_convergence?: string | null;
 notes?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "pass\_runs\_pipeline\_run\_id\_fkey";
 columns: ["pipeline\_run\_id"];
 referencedRelation: "pipeline\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 pass\_criterion\_results: {
 Row: {
 id: string;
 pass\_run\_id: string;
 criterion\_name: string;
 finding: string;
 impact: string;
 judgment: Database["public"]["Enums"]["criterion\_judgment"];
 divergence\_status: Database["public"]["Enums"]["divergence\_status"] | null;
 agreement\_status: Database["public"]["Enums"]["agreement\_status"] | null;
 resolution\_logic: string | null;
 pass1\_summary: string | null;
 pass2\_summary: string | null;
 conflict\_description: string | null;
 created\_at: string;
 };
 Insert: {
 id?: string;
 pass\_run\_id: string;
 criterion\_name: string;
 finding: string;
 impact: string;
 judgment: Database["public"]["Enums"]["criterion\_judgment"];
 divergence\_status?: Database["public"]["Enums"]["divergence\_status"] | null;
 agreement\_status?: Database["public"]["Enums"]["agreement\_status"] | null;
 resolution\_logic?: string | null;
 pass1\_summary?: string | null;
 pass2\_summary?: string | null;
 conflict\_description?: string | null;
 created\_at?: string;
 };
 Update: {
 id?: string;
 pass\_run\_id?: string;
 criterion\_name?: string;
 finding?: string;
 impact?: string;
 judgment?: Database["public"]["Enums"]["criterion\_judgment"];
 divergence\_status?: Database["public"]["Enums"]["divergence\_status"] | null;
 agreement\_status?: Database["public"]["Enums"]["agreement\_status"] | null;
 resolution\_logic?: string | null;
 pass1\_summary?: string | null;
 pass2\_summary?: string | null;
 conflict\_description?: string | null;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "pass\_criterion\_results\_pass\_run\_id\_fkey";
 columns: ["pass\_run\_id"];
 referencedRelation: "pass\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 pass\_criterion\_evidence: {
 Row: {
 id: string;
 criterion\_result\_id: string;
 evidence\_text: string;
 evidence\_order: number;
 created\_at: string;
 };
 Insert: {
 id?: string;
 criterion\_result\_id: string;
 evidence\_text: string;
 evidence\_order?: number;
 created\_at?: string;
 };
 Update: {
 id?: string;
 criterion\_result\_id?: string;
 evidence\_text?: string;
 evidence\_order?: number;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "pass\_criterion\_evidence\_criterion\_result\_id\_fkey";
 columns: ["criterion\_result\_id"];
 referencedRelation: "pass\_criterion\_results";
 referencedColumns: ["id"];
 }
 ];
 };
 wave\_executions: {
 Row: {
 id: string;
 pipeline\_run\_id: string;
 eligible: boolean;
 invocation\_valid: boolean;
 invoked: boolean;
 completed: boolean;
 notes: string | null;
 started\_at: string | null;
 completed\_at: string | null;
 created\_at: string;
 updated\_at: string;
 };
 Insert: {
 id?: string;
 pipeline\_run\_id: string;
 eligible?: boolean;
 invocation\_valid?: boolean;
 invoked?: boolean;
 completed?: boolean;
 notes?: string | null;
 started\_at?: string | null;
 completed\_at?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Update: {
 id?: string;
 pipeline\_run\_id?: string;
 eligible?: boolean;
 invocation\_valid?: boolean;
 invoked?: boolean;
 completed?: boolean;
 notes?: string | null;
 started\_at?: string | null;
 completed\_at?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "wave\_executions\_pipeline\_run\_id\_fkey";
 columns: ["pipeline\_run\_id"];
 referencedRelation: "pipeline\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 wave\_runs: {
 Row: {
 id: string;
 wave\_execution\_id: string;
 wave\_number: number;
 execution\_order: number;
 completed: boolean;
 notes: string | null;
 created\_at: string;
 };
 Insert: {
 id?: string;
 wave\_execution\_id: string;
 wave\_number: number;
 execution\_order: number;
 completed?: boolean;
 notes?: string | null;
 created\_at?: string;
 };
 Update: {
 id?: string;
 wave\_execution\_id?: string;
 wave\_number?: number;
 execution\_order?: number;
 completed?: boolean;
 notes?: string | null;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "wave\_runs\_wave\_execution\_id\_fkey";
 columns: ["wave\_execution\_id"];
 referencedRelation: "wave\_executions";
 referencedColumns: ["id"];
 }
 ];
 };
 wave\_revision\_targets: {
 Row: {
 id: string;
 wave\_execution\_id: string;
 zone: string;
 issue\_type: string;
 recommended\_wave: number;
 priority: Database["public"]["Enums"]["priority\_level"];
 directive: string | null;
 created\_at: string;
 };
 Insert: {
 id?: string;
 wave\_execution\_id: string;
 zone: string;
 issue\_type: string;
 recommended\_wave: number;
 priority: Database["public"]["Enums"]["priority\_level"];
 directive?: string | null;
 created\_at?: string;
 };
 Update: {
 id?: string;
 wave\_execution\_id?: string;
 zone?: string;
 issue\_type?: string;
 recommended\_wave?: number;
 priority?: Database["public"]["Enums"]["priority\_level"];
 directive?: string | null;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "wave\_revision\_targets\_wave\_execution\_id\_fkey";
 columns: ["wave\_execution\_id"];
 referencedRelation: "wave\_executions";
 referencedColumns: ["id"];
 }
 ];
 };
 validation\_runs: {
 Row: {
 id: string;
 pipeline\_run\_id: string;
 checklist\_version: string;
 all\_checks\_passed: boolean;
 validated\_at: string | null;
 created\_at: string;
 updated\_at: string;
 };
 Insert: {
 id?: string;
 pipeline\_run\_id: string;
 checklist\_version: string;
 all\_checks\_passed?: boolean;
 validated\_at?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Update: {
 id?: string;
 pipeline\_run\_id?: string;
 checklist\_version?: string;
 all\_checks\_passed?: boolean;
 validated\_at?: string | null;
 created\_at?: string;
 updated\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "validation\_runs\_pipeline\_run\_id\_fkey";
 columns: ["pipeline\_run\_id"];
 referencedRelation: "pipeline\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 validation\_check\_results: {
 Row: {
 id: string;
 validation\_run\_id: string;
 check\_code: string;
 passed: boolean;
 notes: string | null;
 created\_at: string;
 };
 Insert: {
 id?: string;
 validation\_run\_id: string;
 check\_code: string;
 passed: boolean;
 notes?: string | null;
 created\_at?: string;
 };
 Update: {
 id?: string;
 validation\_run\_id?: string;
 check\_code?: string;
 passed?: boolean;
 notes?: string | null;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "validation\_check\_results\_validation\_run\_id\_fkey";
 columns: ["validation\_run\_id"];
 referencedRelation: "validation\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 governance\_logs: {
 Row: {
 id: string;
 pipeline\_run\_id: string;
 decision: Database["public"]["Enums"]["governance\_decision"];
 blocked: boolean;
 reason: string | null;
 metadata: Json;
 created\_at: string;
 };
 Insert: {
 id?: string;
 pipeline\_run\_id: string;
 decision: Database["public"]["Enums"]["governance\_decision"];
 blocked?: boolean;
 reason?: string | null;
 metadata?: Json;
 created\_at?: string;
 };
 Update: {
 id?: string;
 pipeline\_run\_id?: string;
 decision?: Database["public"]["Enums"]["governance\_decision"];
 blocked?: boolean;
 reason?: string | null;
 metadata?: Json;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "governance\_logs\_pipeline\_run\_id\_fkey";
 columns: ["pipeline\_run\_id"];
 referencedRelation: "pipeline\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 artifacts: {
 Row: {
 id: string;
 pipeline\_run\_id: string;
 artifact\_type: Database["public"]["Enums"]["artifact\_type"];
 artifact\_key: string;
 storage\_path: string | null;
 manifest: Json;
 created\_at: string;
 };
 Insert: {
 id?: string;
 pipeline\_run\_id: string;
 artifact\_type: Database["public"]["Enums"]["artifact\_type"];
 artifact\_key: string;
 storage\_path?: string | null;
 manifest?: Json;
 created\_at?: string;
 };
 Update: {
 id?: string;
 pipeline\_run\_id?: string;
 artifact\_type?: Database["public"]["Enums"]["artifact\_type"];
 artifact\_key?: string;
 storage\_path?: string | null;
 manifest?: Json;
 created\_at?: string;
 };
 Relationships: [
 {
 foreignKeyName: "artifacts\_pipeline\_run\_id\_fkey";
 columns: ["pipeline\_run\_id"];
 referencedRelation: "pipeline\_runs";
 referencedColumns: ["id"];
 }
 ];
 };
 };
 Views: {
 [\_ in never]: never;
 };
 Functions: {
 is\_valid\_pipeline\_transition: {
 Args: {
 from\_state: Database["public"]["Enums"]["pipeline\_state"];
 to\_state: Database["public"]["Enums"]["pipeline\_state"];
 };
 Returns: boolean;
 };
 user\_owns\_manuscript: {
 Args: {
 target\_manuscript\_id: string;
 };
 Returns: boolean;
 };
 user\_owns\_pipeline\_run: {
 Args: {
 target\_pipeline\_run\_id: string;
 };
 Returns: boolean;
 };
 };
 Enums: {
 pipeline\_state:
 | "draft"
 | "pass1\_complete"
 | "pass2\_complete"
 | "converged"
 | "wave\_eligible"
 | "wave\_executed"
 | "revised\_output"
 | "validated"
 | "rejected";
 execution\_mode: "trusted\_path" | "studio";
 pass\_status: "not\_started" | "in\_progress" | "complete" | "failed" | "invalid";
 governance\_decision: "allow" | "block" | "reject" | "require\_revision";
 criterion\_judgment: "effective" | "ineffective" | "mixed";
 divergence\_status: "confirms" | "challenges" | "expands";
 agreement\_status: "agreement" | "partial\_agreement" | "disagreement";
 priority\_level: "high" | "medium" | "low";
 artifact\_type:
 | "pass\_output"
 | "wave\_output"
 | "validation\_output"
 | "governance\_log"
 | "audit\_bundle"
 | "manifest"
 | "source\_snapshot"
 | "normalized\_snapshot";
 };
 CompositeTypes: {
 [\_ in never]: never;
 };
 };
};

**src/lib/pipeline-types.ts**

import type { Database } from "@/types/database";

export type PipelineState = Database["public"]["Enums"]["pipeline\_state"];
export type ExecutionMode = Database["public"]["Enums"]["execution\_mode"];
export type PassStatus = Database["public"]["Enums"]["pass\_status"];
export type GovernanceDecision = Database["public"]["Enums"]["governance\_decision"];
export type CriterionJudgment = Database["public"]["Enums"]["criterion\_judgment"];
export type DivergenceStatus = Database["public"]["Enums"]["divergence\_status"];
export type AgreementStatus = Database["public"]["Enums"]["agreement\_status"];
export type PriorityLevel = Database["public"]["Enums"]["priority\_level"];
export type ArtifactType = Database["public"]["Enums"]["artifact\_type"];

export interface CriterionResult {
 criterionName: string;
 finding: string;
 evidence: string[];
 impact: string;
 judgment: CriterionJudgment;
 divergenceStatus?: DivergenceStatus | null;
 agreementStatus?: AgreementStatus | null;
 resolutionLogic?: string | null;
 pass1Summary?: string | null;
 pass2Summary?: string | null;
 conflictDescription?: string | null;
}

export interface PassSummary {
 primaryStrength?: string | null;
 primaryWeakness?: string | null;
 dominantPattern?: string | null;
 divergenceSummary?: string | null;
 convergenceSummary?: string | null;
}

export interface PassOutput {
 passType: "pass1" | "pass2" | "pass3";
 manuscriptId: string;
 chapterId: string;
 criteria: CriterionResult[];
 summary: PassSummary;
 completedAt: string;
}

export interface RevisionTarget {
 zone: string;
 issueType: string;
 recommendedWave: number;
 priority: PriorityLevel;
 directive?: string | null;
}

export interface WaveExecutionOutput {
 manuscriptId: string;
 chapterId: string;
 eligible: boolean;
 invocationValid: boolean;
 revisionTargets: RevisionTarget[];
 wavesRun: number[];
 completedAt: string;
}

export interface ValidationCheck {
 checkCode: string;
 passed: boolean;
 notes?: string | null;
}

export interface ValidationOutput {
 checklistVersion: string;
 allChecksPassed: boolean;
 failedChecks: string[];
 checks: ValidationCheck[];
 validatedAt: string;
}

export const ALLOWED\_TRANSITIONS: Record<PipelineState, PipelineState[]> = {
 draft: ["pass1\_complete", "rejected"],
 pass1\_complete: ["pass2\_complete", "rejected"],
 pass2\_complete: ["converged", "rejected"],
 converged: ["wave\_eligible", "rejected"],
 wave\_eligible: ["wave\_executed", "rejected"],
 wave\_executed: ["revised\_output", "rejected"],
 revised\_output: ["validated", "rejected"],
 validated: [],
 rejected: [],
};

export function isValidTransition(from: PipelineState, to: PipelineState): boolean {
 return ALLOWED\_TRANSITIONS[from].includes(to);
}

export interface WaveInvocationContext {
 currentState: PipelineState;
 pass1Status: PassStatus;
 pass2Status: PassStatus;
 pass3Status: PassStatus;
 blocked: boolean;
}

export function canInvokeWave(ctx: WaveInvocationContext): boolean {
 return (
 ctx.currentState === "converged" &&
 ctx.pass1Status === "complete" &&
 ctx.pass2Status === "complete" &&
 ctx.pass3Status === "complete" &&
 ctx.blocked === false
 );
}
