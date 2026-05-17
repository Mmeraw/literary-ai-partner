# Pipeline Health Support Cockpit Spec

Status: Canonical implementation authority for `/admin/pipeline-health`; does not supersede governed SIPOC canon.

## Purpose

This page is an admin-only support-ops cockpit. It is not a generic metrics dashboard.

Primary workflow:

User reports failure → admin searches by email / user_id / job_id / manuscript_id / support ticket → admin finds the failed job in under 20 seconds → expands the job row → sees the exact failing step and persisted metric → retries the job or copies a truthful support reply without leaving the page.

This document is the implementation authority for `/admin/pipeline-health`.

## Canon rule

The dashboard must not silently rewrite SIPOC canon.

The governed SIPOC contract remains canonical. Dashboard cells are a support-facing projection over that contract.

Each visual dashboard cell must include:

- `canonicalStageId`
- `displayLabel`

Dashboard cells are allowed to group or split display labels only if they preserve a `canonicalStageId` mapping.

If the UI groups or splits stages for readability, that is a dashboard projection only. It does not change canonical stage identity.

## Truth rule

No mocked truth. No fake zeroes. No invented failure explanations.

If data is not currently backed by persisted storage, the API must return:

- `available: false`
- `reason: "view_missing" | "table_missing" | "field_not_persisted"`
- `missingDependency: string`

The UI must render unavailable states honestly.

Missing Pass 4 / cross-check evidence must render as missing evidence, not as a zombie/heartbeat explanation or any other inferred narrative.

## Required read surfaces

### Required endpoints

- extend `GET /api/admin/pipeline-health`
- add `GET /api/admin/pipeline-health/jobs`
- add `GET /api/admin/pipeline-health/jobs/[id]/steps`
- add `GET /api/admin/pipeline-health/jobs/[id]/steps/[k]/chunks`
- add `GET /api/admin/pipeline-health/taxonomy`

### Required DB / read models

- `pipeline_health_kpi_24h`
- `pipeline_step_observations`
- `admin_audit_log`

If a view or table is not provisioned yet, the API must return `available:false`; it must not synthesize fake data.

### Required UI sections

- Top persistent support search bar
- Filter chips
- KPI tiles
- SIPOC strip / support projection
- Recent jobs table
- Coverage pill on every job row
- Expandable step-contract panel
- Pass timing strip
- Pass 1 / Pass 2 chunk drilldown
- Failure taxonomy tile
- SIPOC fixtures tile
- Self-recovery tile
- Actions column: retry, copy support reply, open user history

## Search and paging rules

Search is the entry point, not an extra feature.

The page must support search by:

- email
- user_id
- job_id
- manuscript_id
- support ticket

Default list view:

- failed jobs
- last 24 hours
- newest first

Pagination must be keyset-based, not offset-based.

## KPI rule

Top KPI tiles must read from a materialized 24-hour rollup, not from live aggregate scans on page load.

## Audit and auth rule

This page is admin-only.

Required protections:

- middleware role gate
- RLS enforcement
- audit log write on page load
- audit log write on job-row expansion
- audit log write on retry and reply actions

## Step-contract rule

The expanded job row is the canonical diagnostic surface.

Each step row must render:

- `input.spec`
- `metric persisted`
- `output.spec`
- `last_event_at`

The page must help support diagnose without requiring a log dive.

## Acceptance fixtures

### Fixture A — Cartel Babies

Expected visible diagnosis:

- low coverage is visible
- Pass 1 failure is visible
- truncation is visible
- prompt-window chars are visible
- chunk evidence scarcity is visible
- admin can diagnose without docx autopsy or logs

### Fixture B — Froggin

Expected visible diagnosis:

- missing Pass 4 / cross-check evidence is rendered as missing evidence
- UI does not invent zombie/heartbeat explanation
- required-mode contradiction is visible if present

### Fixture C — Dominatus-style long-form coverage failure

Expected visible diagnosis:

- long-form coverage insufficiency is visible
- front-loaded / partial analysis is visible
- manuscript-wide certification cannot appear healthy when coverage is insufficient

## Acceptance bar

A support admin can paste a user email, find the failed job in under 20 seconds, expand it, see the failing step and persisted metric, copy a truthful support reply, and retry with audit logging — without leaving the page or reading logs.
