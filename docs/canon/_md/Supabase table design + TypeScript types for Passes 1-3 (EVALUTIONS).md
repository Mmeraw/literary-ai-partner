**Supabase table design + TypeScript types for Passes 1-3 (EVALUTIONS)** for the exact RevisionGrade pipeline.

-- =========================================================
-- REVISIONGRADE PIPELINE — SUPABASE TABLE DESIGN
-- Canon-aligned to:
-- Pass 1 -> Pass 2 -> Pass 3 -> WAVE -> Validation
-- =========================================================

-- ---------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------

create type pipeline\_state as enum (
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

create type execution\_mode as enum (
 'trusted\_path',
 'studio'
);

create type pass\_status as enum (
 'not\_started',
 'in\_progress',
 'complete',
 'failed',
 'invalid'
);

create type governance\_decision as enum (
 'allow',
 'block',
 'reject',
 'require\_revision'
);

create type criterion\_judgment as enum (
 'effective',
 'ineffective',
 'mixed'
);

create type divergence\_status as enum (
 'confirms',
 'challenges',
 'expands'
);

create type agreement\_status as enum (
 'agreement',
 'partial\_agreement',
 'disagreement'
);

create type priority\_level as enum (
 'high',
 'medium',
 'low'
);

create type artifact\_type as enum (
 'pass\_output',
 'wave\_output',
 'validation\_output',
 'governance\_log',
 'audit\_bundle',
 'manifest',
 'source\_snapshot',
 'normalized\_snapshot'
);

-- ---------------------------------------------------------
-- 2. MANUSCRIPTS / CHAPTERS
-- ---------------------------------------------------------

create table if not exists manuscripts (
 id uuid primary key default gen\_random\_uuid(),
 manuscript\_code text not null unique,
 title text not null,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now()
);

create table if not exists chapters (
 id uuid primary key default gen\_random\_uuid(),
 manuscript\_id uuid not null references manuscripts(id) on delete cascade,
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

create index if not exists idx\_chapters\_manuscript\_id on chapters(manuscript\_id);

-- ---------------------------------------------------------
-- 3. PIPELINE RUNS
-- One row = one governed pipeline lifecycle for one chapter
-- ---------------------------------------------------------

create table if not exists pipeline\_runs (
 id uuid primary key default gen\_random\_uuid(),
 manuscript\_id uuid not null references manuscripts(id) on delete cascade,
 chapter\_id uuid not null references chapters(id) on delete cascade,
 execution\_mode execution\_mode not null default 'trusted\_path',
 current\_state pipeline\_state not null default 'draft',
 blocked boolean not null default false,
 rejection\_reason text,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now(),
 completed\_at timestamptz,
 unique (chapter\_id, created\_at)
);

create index if not exists idx\_pipeline\_runs\_chapter\_id on pipeline\_runs(chapter\_id);
create index if not exists idx\_pipeline\_runs\_state on pipeline\_runs(current\_state);

-- ---------------------------------------------------------
-- 4. STATE HISTORY
-- ---------------------------------------------------------

create table if not exists pipeline\_state\_history (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references pipeline\_runs(id) on delete cascade,
 from\_state pipeline\_state,
 to\_state pipeline\_state not null,
 action text not null,
 actor text not null default 'system',
 reason text,
 created\_at timestamptz not null default now()
);

create index if not exists idx\_pipeline\_state\_history\_run\_id
 on pipeline\_state\_history(pipeline\_run\_id);

-- ---------------------------------------------------------
-- 5. PASS RUNS
-- Pass 1 / Pass 2 / Pass 3 headers
-- ---------------------------------------------------------

create table if not exists pass\_runs (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references pipeline\_runs(id) on delete cascade,
 pass\_number integer not null check (pass\_number in (1,2,3)),
 status pass\_status not null default 'not\_started',
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

create index if not exists idx\_pass\_runs\_pipeline\_run\_id on pass\_runs(pipeline\_run\_id);

-- ---------------------------------------------------------
-- 6. PASS CRITERION RESULTS
-- One row per criterion per pass
-- ---------------------------------------------------------

create table if not exists pass\_criterion\_results (
 id uuid primary key default gen\_random\_uuid(),
 pass\_run\_id uuid not null references pass\_runs(id) on delete cascade,
 criterion\_name text not null,
 finding text not null,
 impact text not null,
 judgment criterion\_judgment not null,
 divergence\_status divergence\_status,
 agreement\_status agreement\_status,
 resolution\_logic text,
 pass1\_summary text,
 pass2\_summary text,
 conflict\_description text,
 created\_at timestamptz not null default now()
);

create index if not exists idx\_pass\_criterion\_results\_pass\_run\_id
 on pass\_criterion\_results(pass\_run\_id);

-- ---------------------------------------------------------
-- 7. PASS EVIDENCE
-- Many evidence lines per criterion
-- ---------------------------------------------------------

create table if not exists pass\_criterion\_evidence (
 id uuid primary key default gen\_random\_uuid(),
 criterion\_result\_id uuid not null references pass\_criterion\_results(id) on delete cascade,
 evidence\_text text not null,
 evidence\_order integer not null default 1,
 created\_at timestamptz not null default now()
);

create index if not exists idx\_pass\_criterion\_evidence\_result\_id
 on pass\_criterion\_evidence(criterion\_result\_id);

-- ---------------------------------------------------------
-- 8. WAVE EXECUTION
-- Header row for WAVE stage
-- ---------------------------------------------------------

create table if not exists wave\_executions (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null unique references pipeline\_runs(id) on delete cascade,
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

-- ---------------------------------------------------------
-- 9. WAVE RUNS
-- Which individual waves executed
-- ---------------------------------------------------------

create table if not exists wave\_runs (
 id uuid primary key default gen\_random\_uuid(),
 wave\_execution\_id uuid not null references wave\_executions(id) on delete cascade,
 wave\_number integer not null check (wave\_number between 1 and 62),
 execution\_order integer not null,
 completed boolean not null default false,
 notes text,
 created\_at timestamptz not null default now(),
 unique (wave\_execution\_id, wave\_number)
);

create index if not exists idx\_wave\_runs\_execution\_id on wave\_runs(wave\_execution\_id);

-- ---------------------------------------------------------
-- 10. WAVE REVISION TARGETS
-- ---------------------------------------------------------

create table if not exists wave\_revision\_targets (
 id uuid primary key default gen\_random\_uuid(),
 wave\_execution\_id uuid not null references wave\_executions(id) on delete cascade,
 zone text not null,
 issue\_type text not null,
 recommended\_wave integer not null check (recommended\_wave between 1 and 62),
 priority priority\_level not null,
 directive text,
 created\_at timestamptz not null default now()
);

create index if not exists idx\_wave\_revision\_targets\_execution\_id
 on wave\_revision\_targets(wave\_execution\_id);

-- ---------------------------------------------------------
-- 11. VALIDATION RUNS
-- Binary Acceptance Checklist
-- ---------------------------------------------------------

create table if not exists validation\_runs (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null unique references pipeline\_runs(id) on delete cascade,
 checklist\_version text not null,
 all\_checks\_passed boolean not null default false,
 validated\_at timestamptz,
 created\_at timestamptz not null default now(),
 updated\_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- 12. VALIDATION CHECK RESULTS
-- ---------------------------------------------------------

create table if not exists validation\_check\_results (
 id uuid primary key default gen\_random\_uuid(),
 validation\_run\_id uuid not null references validation\_runs(id) on delete cascade,
 check\_code text not null,
 passed boolean not null,
 notes text,
 created\_at timestamptz not null default now(),
 unique (validation\_run\_id, check\_code)
);

create index if not exists idx\_validation\_check\_results\_run\_id
 on validation\_check\_results(validation\_run\_id);

-- ---------------------------------------------------------
-- 13. GOVERNANCE LOGS
-- ---------------------------------------------------------

create table if not exists governance\_logs (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references pipeline\_runs(id) on delete cascade,
 decision governance\_decision not null,
 blocked boolean not null default false,
 reason text,
 metadata jsonb not null default '{}'::jsonb,
 created\_at timestamptz not null default now()
);

create index if not exists idx\_governance\_logs\_run\_id
 on governance\_logs(pipeline\_run\_id);

-- ---------------------------------------------------------
-- 14. ARTIFACTS
-- ---------------------------------------------------------

create table if not exists artifacts (
 id uuid primary key default gen\_random\_uuid(),
 pipeline\_run\_id uuid not null references pipeline\_runs(id) on delete cascade,
 artifact\_type artifact\_type not null,
 artifact\_key text not null,
 storage\_path text,
 manifest jsonb not null default '{}'::jsonb,
 created\_at timestamptz not null default now()
);

create index if not exists idx\_artifacts\_run\_id on artifacts(pipeline\_run\_id);

-- ---------------------------------------------------------
-- 15. UPDATED\_AT TRIGGER
-- ---------------------------------------------------------

create or replace function set\_updated\_at()
returns trigger
language plpgsql
as $$
begin
 new.updated\_at = now();
 return new;
end;
$$;

drop trigger if exists trg\_manuscripts\_updated\_at on manuscripts;
create trigger trg\_manuscripts\_updated\_at
before update on manuscripts
for each row execute function set\_updated\_at();

drop trigger if exists trg\_chapters\_updated\_at on chapters;
create trigger trg\_chapters\_updated\_at
before update on chapters
for each row execute function set\_updated\_at();

drop trigger if exists trg\_pipeline\_runs\_updated\_at on pipeline\_runs;
create trigger trg\_pipeline\_runs\_updated\_at
before update on pipeline\_runs
for each row execute function set\_updated\_at();

drop trigger if exists trg\_pass\_runs\_updated\_at on pass\_runs;
create trigger trg\_pass\_runs\_updated\_at
before update on pass\_runs
for each row execute function set\_updated\_at();

drop trigger if exists trg\_wave\_executions\_updated\_at on wave\_executions;
create trigger trg\_wave\_executions\_updated\_at
before update on wave\_executions
for each row execute function set\_updated\_at();

drop trigger if exists trg\_validation\_runs\_updated\_at on validation\_runs;
create trigger trg\_validation\_runs\_updated\_at
before update on validation\_runs
for each row execute function set\_updated\_at();

-- ---------------------------------------------------------
-- 16. OPTIONAL STATE TRANSITION VALIDATOR
-- ---------------------------------------------------------

create or replace function is\_valid\_pipeline\_transition(
 from\_state pipeline\_state,
 to\_state pipeline\_state
)
returns boolean
language sql
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

// ========================================================
// REVISIONGRADE PIPELINE — TYPESCRIPT TYPES
// ========================================================

export type PipelineState =
 | "draft"
 | "pass1\_complete"
 | "pass2\_complete"
 | "converged"
 | "wave\_eligible"
 | "wave\_executed"
 | "revised\_output"
 | "validated"
 | "rejected";

export type ExecutionMode = "trusted\_path" | "studio";

export type PassStatus =
 | "not\_started"
 | "in\_progress"
 | "complete"
 | "failed"
 | "invalid";

export type GovernanceDecision =
 | "allow"
 | "block"
 | "reject"
 | "require\_revision";

export type CriterionJudgment =
 | "effective"
 | "ineffective"
 | "mixed";

export type DivergenceStatus =
 | "confirms"
 | "challenges"
 | "expands";

export type AgreementStatus =
 | "agreement"
 | "partial\_agreement"
 | "disagreement";

export type PriorityLevel = "high" | "medium" | "low";

export type ArtifactType =
 | "pass\_output"
 | "wave\_output"
 | "validation\_output"
 | "governance\_log"
 | "audit\_bundle"
 | "manifest"
 | "source\_snapshot"
 | "normalized\_snapshot";

export interface ManuscriptRow {
 id: string;
 manuscript\_code: string;
 title: string;
 created\_at: string;
 updated\_at: string;
}

export interface ChapterRow {
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
}

export interface PipelineRunRow {
 id: string;
 manuscript\_id: string;
 chapter\_id: string;
 execution\_mode: ExecutionMode;
 current\_state: PipelineState;
 blocked: boolean;
 rejection\_reason: string | null;
 created\_at: string;
 updated\_at: string;
 completed\_at: string | null;
}

export interface PipelineStateHistoryRow {
 id: string;
 pipeline\_run\_id: string;
 from\_state: PipelineState | null;
 to\_state: PipelineState;
 action: string;
 actor: string;
 reason: string | null;
 created\_at: string;
}

export interface PassRunRow {
 id: string;
 pipeline\_run\_id: string;
 pass\_number: 1 | 2 | 3;
 status: PassStatus;
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
}

export interface PassCriterionResultRow {
 id: string;
 pass\_run\_id: string;
 criterion\_name: string;
 finding: string;
 impact: string;
 judgment: CriterionJudgment;
 divergence\_status: DivergenceStatus | null;
 agreement\_status: AgreementStatus | null;
 resolution\_logic: string | null;
 pass1\_summary: string | null;
 pass2\_summary: string | null;
 conflict\_description: string | null;
 created\_at: string;
}

export interface PassCriterionEvidenceRow {
 id: string;
 criterion\_result\_id: string;
 evidence\_text: string;
 evidence\_order: number;
 created\_at: string;
}

export interface WaveExecutionRow {
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
}

export interface WaveRunRow {
 id: string;
 wave\_execution\_id: string;
 wave\_number: number;
 execution\_order: number;
 completed: boolean;
 notes: string | null;
 created\_at: string;
}

export interface WaveRevisionTargetRow {
 id: string;
 wave\_execution\_id: string;
 zone: string;
 issue\_type: string;
 recommended\_wave: number;
 priority: PriorityLevel;
 directive: string | null;
 created\_at: string;
}

export interface ValidationRunRow {
 id: string;
 pipeline\_run\_id: string;
 checklist\_version: string;
 all\_checks\_passed: boolean;
 validated\_at: string | null;
 created\_at: string;
 updated\_at: string;
}

export interface ValidationCheckResultRow {
 id: string;
 validation\_run\_id: string;
 check\_code: string;
 passed: boolean;
 notes: string | null;
 created\_at: string;
}

export interface GovernanceLogRow {
 id: string;
 pipeline\_run\_id: string;
 decision: GovernanceDecision;
 blocked: boolean;
 reason: string | null;
 metadata: Record<string, unknown>;
 created\_at: string;
}

export interface ArtifactRow {
 id: string;
 pipeline\_run\_id: string;
 artifact\_type: ArtifactType;
 artifact\_key: string;
 storage\_path: string | null;
 manifest: Record<string, unknown>;
 created\_at: string;
}

// ========================================================
// COMPOSITE DOMAIN TYPES
// ========================================================

export interface CriterionResult {
 criterionName: string;
 finding: string;
 evidence: string[];
 impact: string;
 judgment: CriterionJudgment;
 divergenceStatus?: DivergenceStatus;
 agreementStatus?: AgreementStatus;
 resolutionLogic?: string;
 pass1Summary?: string;
 pass2Summary?: string;
 conflictDescription?: string;
}

export interface PassSummary {
 primaryStrength?: string;
 primaryWeakness?: string;
 dominantPattern?: string;
 divergenceSummary?: string;
 convergenceSummary?: string;
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
 directive?: string;
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
 notes?: string;
}

export interface ValidationOutput {
 checklistVersion: string;
 allChecksPassed: boolean;
 failedChecks: string[];
 checks: ValidationCheck[];
 validatedAt: string;
}

export interface PipelineRecord {
 manuscriptId: string;
 chapterId: string;
 currentState: PipelineState;
 executionMode: ExecutionMode;
 createdAt: string;
 updatedAt: string;
 passes: {
 pass1: {
 status: PassStatus;
 completed: boolean;
 criteriaEvaluated: string[];
 outputId?: string;
 checklistPassed?: boolean;
 notes?: string;
 };
 pass2: {
 status: PassStatus;
 completed: boolean;
 criteriaEvaluated: string[];
 outputId?: string;
 checklistPassed?: boolean;
 notes?: string;
 };
 pass3: {
 status: PassStatus;
 completed: boolean;
 criteriaEvaluated: string[];
 outputId?: string;
 checklistPassed?: boolean;
 notes?: string;
 };
 };
 waveExecution?: {
 eligible: boolean;
 invoked: boolean;
 completed: boolean;
 wavesRun: number[];
 outputId?: string;
 };
 validation?: {
 checklistVersion: string;
 allChecksPassed: boolean;
 failedChecks: string[];
 validatedAt?: string;
 };
 governance: {
 blocked: boolean;
 reasons: string[];
 lastDecision?: GovernanceDecision;
 };
 audit?: {
 artifactIds: string[];
 sourceHash?: string;
 normalizedHash?: string;
 history: Array<{
 timestamp: string;
 state: PipelineState;
 action: string;
 actor?: string;
 }>;
 };
}

// ========================================================
// TRANSITION RULES
// ========================================================

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

export function isValidTransition(
 from: PipelineState,
 to: PipelineState
): boolean {
 return ALLOWED\_TRANSITIONS[from].includes(to);
}

// ========================================================
// WAVE INVOCATION GUARD
// ========================================================

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
