# Pipeline Health PR Plan

Status: Sequencing plan for `/admin/pipeline-health`

This plan exists to keep implementation narrow, reviewable, and canon-safe.

## PR A — Spec only

Title:

`docs(admin): formalize pipeline-health support cockpit spec`

Files:

- `docs/admin/PIPELINE_HEALTH_SUPPORT_COCKPIT_SPEC.md`
- `docs/admin/PIPELINE_HEALTH_PR_PLAN.md`

Runtime changes:

- none

Purpose:

- lock page identity
- lock canon rule
- lock truth rule
- prevent future agent drift

## PR B — Truthful failure rendering

Goal:

UI must never invent failure explanations.

Scope:

- fix missing Pass 4 / cross-check fallback behavior
- render missing evidence truthfully
- add regression coverage for Froggin-style contradiction

## PR C — Backend read model foundation

Scope:

- add `lib/admin/pipelineHealthTypes.ts`
- extend `GET /api/admin/pipeline-health`
- add `GET /api/admin/pipeline-health/jobs`
- add `GET /api/admin/pipeline-health/jobs/[id]/steps`
- add `GET /api/admin/pipeline-health/taxonomy`
- add unavailable response shape

Unavailable response contract:

- `available: false`
- `reason`
- `missingDependency`

Rule:

- no fake zeroes

## PR D — SQL / view layer

Scope:

- add `pipeline_health_kpi_24h`
- add `pipeline_step_observations`
- add `admin_audit_log`

Rules:

- KPI tiles from materialized 24h rollup
- job lists support keyset pagination
- audit surface exists before admin actions expand
- if a view/table is not provisioned yet, the API must return `available:false`; it must not synthesize fake data

## PR E — Support workflow UI

Scope:

- dark cockpit layout
- top search bar
- filter chips
- failed 24h default
- user column
- plan badge
- job table
- coverage pill
- expandable step-contract row

Goal:

Implement the core support workflow before decorative dashboard work.

## PR F — Step-contract + chunk telemetry

Scope:

- 11-step panel
- pass timing bars
- chunk drilldown for Pass 1 / Pass 2
- coverage / truncation / prompt-window metrics

Rule:

Each step renders:

- `input.spec`
- `metric persisted`
- `output.spec`

## PR G — Right rail + actions

Scope:

- failure taxonomy
- SIPOC fixtures tile
- self-recovery tile
- retry modal
- copy support reply
- open user history
- audit writes for actions

Rule:

Recovery actions land only after audit logging exists.

## Build order

1. Truth layer first
2. Support workflow second
3. Visual cockpit third
4. Recovery actions last

## Non-goals

Do not:

- ship a static mockup as if it were the product
- silently rewrite SIPOC canon
- fake unavailable data as zero
- invent failure explanations
- add recovery actions before audit logging
