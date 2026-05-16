# `/admin/pipeline-health` — Admin Support Landing Addendum

**Date:** 2026-05-13
**Context:** User clarified this is the **admin-only landing page** used to triage failures when any of up to **100k users** reports an evaluation problem on revisiongrade.com. This is a support-ops surface, not a metrics dashboard.

This addendum updates `DASHBOARD_GRANULARITY_GAP_AND_HARDENING_PR.md` (PR-D1 → PR-D4) with the operational and scale requirements.

---

## 1. Workflow this page MUST optimize for

> **User reports failure → admin finds their job in under 20 seconds → diagnoses without leaving the page → either retries, drafts a reply, or files a hardening ticket.**

Anything that adds clicks, leaves the page, or requires a log dive is a regression against this workflow.

## 2. Hard requirements that change PR-D1

### 2a. Per-user identity is first-class on every job row
Add columns:
- **User** column: email (primary), plan tier badge (`free` / `trial` / `paid` / `beta`), `user_id`, support-ticket link if any
- **Actions** column: open-user-history · retry-job · copy-support-reply (template-driven)

Backing data:
- Join `evaluation_jobs.user_id → auth.users` (Supabase) on the server side. Never expose `auth.users.*` to non-admin sessions. RLS policy plus middleware role check.

### 2b. Search is the entry point, not a feature
A persistent search bar at the top of the page accepting any of: email, `user_id`, `job_id`, `manuscript_id`, support ticket #. Search must return in <200 ms p95 against a 10M-job table. Required:
- Trigram index on `auth.users.email` (`pg_trgm`)
- Btree on `evaluation_jobs.user_id`
- Btree on `evaluation_jobs.manuscript_id`
- Hash/btree on `evaluation_jobs.id` (already present as PK)
- Optional: external mapping table `support_tickets(ticket_id, job_id, user_id)` for ticket-# lookup

### 2c. Default view = failed jobs, last 24h, newest first
With filter chips for the common admin queries:
- `Failed · 24h` (default)
- `All · 24h`
- `Failed · 7d`
- `Stuck > 5 min` (jobs in-progress past p99 budget)
- `Coverage < 90%` (silent-truncation suspects)
- `Plan: paid` (revenue-protecting triage priority)

Each chip is a single param on the cursor-paginated list endpoint.

### 2d. Pagination is keyset, not offset
At 10M+ jobs `OFFSET` queries die. Pagination uses keyset cursor on `(created_at desc, id desc)`. Endpoint shape:
```
GET /api/admin/pipeline-health/jobs?status=failed&since=24h&cursor=<created_at>_<id>
→ { jobs: [...25], next_cursor: "...", total_estimate: 487 }
```
`total_estimate` from `pg_class.reltuples` (good enough — exact count is too expensive).

### 2e. Job table query budget
The list endpoint MUST return in <100 ms p95 with a hot cache, <250 ms cold. Achievable with the indexes above + selecting only the row-summary fields. The expanded step-contract is a separate request fired on row-click.

### 2f. KPI tiles from a materialized view, not live aggregates
The 6 top tiles (Jobs / Pass rate / p50 duration / Coverage avg / Failed-closed / SIPOC fixtures) aggregate across 24h. At 100k users this is millions of rows and cannot be live-counted on every page load. Build:
```
CREATE MATERIALIZED VIEW pipeline_health_kpi_24h AS
  SELECT date_trunc('hour', created_at) AS bucket,
         count(*) AS jobs,
         count(*) FILTER (WHERE status='passed') AS passed,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
         avg(coverage_pct) AS coverage_pct_avg,
         count(*) FILTER (WHERE failed_closed=true) AS failed_closed
  FROM evaluation_jobs
  WHERE created_at > now() - interval '25 hours'
  GROUP BY 1;
```
Refresh every 5 min via `REFRESH MATERIALIZED VIEW CONCURRENTLY`. Tile reads = single index scan on the rollup, <50 ms.

### 2g. Auto-refresh polite
Page auto-refreshes the KPI tiles + job list every 30s but ONLY when the tab is in foreground (`document.visibilityState === 'visible'`). Otherwise it stops to save the DB.

## 3. Authorization & audit

This page is admin-only. Required:
- **Middleware role gate**: any request to `/admin/*` or `/api/admin/*` checks `auth.users.app_metadata.role === 'admin'`. 403 + redirect otherwise.
- **RLS on the underlying tables**: `evaluation_jobs`, `pass1_chunk_findings`, etc. — admin role bypass; user role limited to their own `user_id`.
- **Audit log** on the admin landing: every page load + every job-detail expansion writes a row to `admin_audit_log(actor_user_id, action, target_job_id, target_user_id, at)`. Available at `/admin/audit-log` (separate page; not in this PR).
- **PII handling**: emails visible to admins only. The "Copy support reply" template-driven action MUST NOT include `user_id` or `job_id` UUIDs in the public-facing copy — only manuscript title + actionable explanation.

## 4. Actions column behavior

| Icon | Action | Behavior |
|---|---|---|
| 👤 | Open user history | Navigates to `/admin/users/[id]/jobs` — list of all jobs for this user, with same step-contract panel pattern |
| ↻ | Retry job | POST `/api/admin/pipeline-health/jobs/[id]/retry` → enqueues a new job using the same `submission_id`. Requires admin confirmation modal. Logs to audit table. |
| ✉ | Copy support reply | Opens a template-picker. Templates per failure code (e.g. `PASS1_TIMEOUT` → "we hit a long-form processing limit on your 137k-word manuscript; we're rerunning it with the new chunker..."). Copies to clipboard. |

## 5. Revised PR-D1 acceptance bar

After PR-D1 lands, a non-engineer admin (e.g. a support rep) can:

1. Receive a support email from `j.alvarez@hotmail.com` reporting "my evaluation just hung for 12 minutes."
2. Paste their email into the search bar on `/admin/pipeline-health`.
3. See exactly ONE failed job for that user in the last 24h: `26220f5b…` (Cartel Babies, 137,758 words, 4.9% coverage, PASS1_TIMEOUT).
4. Click the row to expand the step-contract panel.
5. Read: "Step 4 Pass 1 craft: `truncated=true`, `prompt_window_chars=40000`, `coverage_pct=4.9%`."
6. Click the ✉ action to copy a templated reply explaining the issue + the rerun.
7. Click ↻ to retry the job with the new chunker (post PR #1 merging).

All seven steps complete inside one page, with zero log dives. That is the bar.

## 6. Sequencing impact on PR-D1 → PR-D4

The original 4-PR plan stands, BUT PR-D1 grows to absorb the support-essentials:

- **PR-D1** (was ~6h, now ~10h):
  - Materialized view `pipeline_health_kpi_24h` + 5-min refresh job
  - `pipeline_step_observations` SQL view
  - List endpoint with keyset cursor + filter params + indexes (trigram + btree)
  - Step contract endpoint
  - Coverage pill (UI)
  - User column + plan badges (UI)
  - Search bar (UI + endpoint)
  - Filter chips (UI)
  - RLS policies + middleware role gate
  - `admin_audit_log` table + writes
- **PR-D2** (~5h): expand-row + pass timings (unchanged)
- **PR-D3** (~3h): taxonomy heatmap + SIPOC fixtures tile (unchanged)
- **PR-D4** (~4h, was ~2h): expand SIPOC strip to 11 stages + Actions column wiring (retry + reply templates) + audit log page

Total ~22h.

PR-D1 is now the **biggest** PR of the four because it carries the support-ops payload. If that's too big to land at once, split off PR-D1.5 = "RLS + middleware + audit log scaffolding" so the security primitives land first and the data work follows.

## 7. Scale envelope (sanity check)

Assumptions at 100k users:
- Active users / day: ~10% → 10k
- Jobs / active user / day: ~1.5 → 15k jobs/day → ~5.5M jobs/year
- Failure rate target: <5% → ~750 failed jobs/day → ~25k/month → manageable on the admin landing with paging
- Per-job step ledger rows: 11 steps + ~100 chunks-of-pass-1 + ~100-of-pass-2 = ~211 rows → at 15k jobs/day = ~3.2M ledger rows/day → 1.2B/year. **This needs a retention policy** (e.g., 90-day hot, archive to cold storage). Not in PR-D1 but flagged.

## 8. What this addendum does NOT change

- The 11-step SIPOC contract (canonical, locked).
- The step-contract panel shape `(input.spec ✓/✗, metric, output.spec ✓/✗)`.
- The taxonomy heatmap design.
- The SIPOC fixtures tile.

Those are all still correct as designed.
