# Gate A7 — StoryGate Studio / Shareable Report Preview
System Spec (A6 → A7 → A8 Spine)

Status: PLANNED  
Owner: Founder / Architect  
Preconditions:
- Gate A5 CLOSED (authoritative artifact exists)
- Gate A6 CLOSED (credible artifact content exists)
Successor:
- Gate A8 (Flow 2 batch/multi-submission) depends on A7 share model and load patterns

---

## 0. Thesis

A5 proved "truth exists."  
A6 proved "truth is explainable."  
A7 proves "truth is safely shareable."

A7 introduces **read-only projections** of the canonical evaluation artifact for controlled external viewing (agents/editors) without weakening authority, determinism, or privacy.

Primary risk A7 addresses:
- Market validation requires sharing
- Sharing creates privacy & leakage risk
- "Link sharing" can easily become a security incident

A7 design principle:
> **Fail closed, project only, never recompute, never mutate.**

---

## 1. MDM: Master Data Management Model

### 1.1 Authoritative Sources (single source of truth)

MDM: "Evaluation Truth"
- Table: `evaluation_artifacts`
- Key: `(job_id, artifact_type)`
- Canonical artifact row is authoritative for report content

MDM: "Job Ownership"
- Table: `evaluation_jobs`
- `evaluation_jobs.user_id` is the sole owner of a job and its artifacts

MDM: "Share Authority"
- Table: `report_shares`
- `report_shares.created_by` must equal `evaluation_jobs.user_id`
- share state is authoritative only for access gating (never content)

### 1.2 Allowed Derivations

Allowed:
- Presentation projections (HTML/JSON) that read from `evaluation_artifacts` only
- Analytics events derived from reads (non-authoritative)

Not allowed:
- Recomputing scores, credibility, or rubric breakdown at request time
- Writing/patching artifacts from share routes

---

## 2. Data Contracts

### 2.1 Canonical Artifact Contract (A6 → A7)

Artifact row (subset):
- `job_id` (uuid)
- `artifact_type` (text, e.g. "one_page_summary")
- `artifact_version` (int)
- `content` (jsonb) — includes A6 credibility block
- `source_hash` (text) — deterministic hash
- `source_phase` (text)
- `updated_at` (timestamptz)

A7 consumes these fields exactly and must not reinterpret meaning.

### 2.2 ReportContent JSON Contract (MDM logical schema)

A7 requires a stable JSON contract for the artifact content.

Minimum required for A7:
- `overall_score` (number or numeric string)
- `summary` (string)
- `credibility` object (A6)
  - `rubric_breakdown[]` (axis list)
  - `confidence` (0..1)
  - `coverage_ratio` (0..1)
  - `variance_stability` (0..1)
  - `evidence_count` (>=0)
  - `model_version` (string)
- `generated_at` (ISO string)

A7 rule:
> If `overall_score` exists but `credibility` missing/invalid → **fail closed** (deny or render "Report unavailable").

### 2.3 Share Token Contract

Share tokens must never be stored in plaintext.

Logical share record:
- `id` uuid
- `job_id` uuid
- `artifact_type` text (optional; default "one_page_summary")
- `token_hash` text (unique)
- `created_by` uuid
- `created_at` timestamptz
- `revoked_at` timestamptz nullable
- `expires_at` timestamptz nullable
- `last_viewed_at` timestamptz nullable (optional; for metrics)
- `view_count` bigint default 0 (optional; for metrics)

Token hashing:
- token generated as random 32–64 bytes, base64url
- hash = HMAC-SHA256(secret, token)  (preferred)  
  OR SHA256(token + pepper) (acceptable)
- constant-time compare in application

---

## 3. Business Rules (A7)

### 3.1 Creation Rules

- Only authenticated users may create a share link.
- Creator must own the job: `evaluation_jobs.user_id === auth.user.id`.
- A share must bind to a specific job_id and artifact_type.
- Default share expiry:
  - recommend: 14–30 days
  - allow "no expiry" only for owner-controlled use cases (optional)
- Share creation is idempotent if requested:
  - Option A: allow multiple shares per job
  - Option B: at most one active share per (job_id, artifact_type) (recommended for simplicity)

### 3.2 Access Rules

A token grants read-only access to:
- exactly one `(job_id, artifact_type)`

A token is valid only if:
- share row exists
- not revoked
- not expired
- job exists
- artifact exists
- artifact passes JSON contract checks

If any condition fails → deny with safe response:
- HTTP 404 (preferred to avoid enumeration)
- or HTTP 410 for revoked/expired in authenticated contexts only

### 3.3 Revocation Rules

- Only owner can revoke.
- Revoke sets `revoked_at`.
- Revocation takes effect immediately.
- Revoked tokens must never be reusable.

### 3.4 Projection Rules ("no mutation")

Shared routes:
- must not write to `evaluation_jobs`
- must not write to `evaluation_artifacts`
- may write only to **analytics** tables (optional) and only with bounded rate

If analytics writes fail → do not fail the read.
(never let metrics break the user journey)

---

## 4. Schema (Postgres / Supabase)

### 4.1 Migration: report_shares

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_report_shares.sql

create table if not exists public.report_shares (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.evaluation_jobs(id) on delete cascade,
  artifact_type text not null default 'one_page_summary',
  token_hash text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  expires_at timestamptz null,

  -- optional metrics fields (safe to omit if you prefer events table):
  last_viewed_at timestamptz null,
  view_count bigint not null default 0,

  constraint report_shares_token_hash_len check (char_length(token_hash) >= 32),
  constraint report_shares_artifact_type_nonempty check (char_length(artifact_type) > 0)
);

create unique index if not exists report_shares_token_hash_uidx
  on public.report_shares(token_hash);

create index if not exists report_shares_job_idx
  on public.report_shares(job_id);

create index if not exists report_shares_created_by_idx
  on public.report_shares(created_by);

-- Recommended: one active share per job/artifact_type
create unique index if not exists report_shares_one_active_per_job_uidx
  on public.report_shares(job_id, artifact_type)
  where revoked_at is null;
```

### 4.2 RLS Policies (fail-closed by default)

Enable RLS:

```sql
alter table public.report_shares enable row level security;
```

Owner can create:

```sql
create policy "report_shares_insert_owner_only"
on public.report_shares
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.evaluation_jobs j
    where j.id = report_shares.job_id
      and j.user_id = auth.uid()
  )
);
```

Owner can revoke/update their own shares:

```sql
create policy "report_shares_update_owner_only"
on public.report_shares
for update
to authenticated
using (
  created_by = auth.uid()
)
with check (
  created_by = auth.uid()
);
```

Owner can list their own shares:

```sql
create policy "report_shares_select_owner_only"
on public.report_shares
for select
to authenticated
using (
  created_by = auth.uid()
);
```

Public (anon) access:

Strong recommendation: do NOT allow direct anon selects on report_shares.

Instead, expose an RPC that validates token in a controlled way using service role on server.
This avoids leaking share metadata via RLS complexity.

---

## 5. API Design (A7)

### 5.1 Create Share (Owner)

Route:

```
POST /api/report-shares
```

Inputs:
- `job_id` (uuid)
- optional `expires_in_days` or explicit `expires_at`
- optional `artifact_type`

Outputs:
- `share_url` (contains token)
- `share_id`
- `expires_at`

Server logic:
1. auth required
2. verify job ownership
3. generate token, compute token_hash
4. insert share row (respect uniqueness constraint)
5. return URL

Fail-closed:
- any inconsistency → 404 (job not found) or 403 (not owner)
- never reveal existence of jobs to non-owners

### 5.2 Revoke Share (Owner)

Route:

```
POST /api/report-shares/{shareId}/revoke
```

Logic:
- auth required
- ensure `created_by = auth.uid`
- set `revoked_at = now()`

### 5.3 Shared Report View (Anon)

Route:

```
GET /share/{token}
```

Logic:
1. compute token_hash
2. lookup share row by token_hash (server-side privileged read)
3. check revoked/expired
4. fetch job + artifact (server-side privileged or user-scoped read)
5. validate artifact JSON contract
6. render read-only report

Rendering rule:
- Must render from artifact row only.
- Must display provenance (source_hash, updated_at, artifact_version, model_version).

---

## 6. Mistake-Proofing (Error-Proofing)

### 6.1 Hard Constraints

- Unique `token_hash`
- "one active share per job/artifact_type" partial unique index
- FK constraints to jobs and users
- check constraints for non-empty `artifact_type` and hash length

### 6.2 Fail-Closed Guards (Application)

Shared view must refuse to render if:
- share invalid
- share revoked/expired
- artifact missing
- `artifact.content` fails JSON contract checks
- `artifact_type` mismatch
- job missing

### 6.3 No-Leak Policy

All invalid share tokens return:
- `404 Not Found`
- identical body
- identical timing envelope as much as feasible (avoid easy enumeration)

### 6.4 Rate Limiting

Protect endpoints:
- create share: per-user limit
- view share: per-token + per-IP limits
- revoke share: per-user limit

### 6.5 Content Safety

Never render raw HTML from artifact content.
Render text only (escape).
If you later add formatted content, whitelist strictly.

---

## 7. QA / QC (A7 Proof Requirements)

### 7.1 Unit Tests

- token generation and hashing
- token compare constant-time helper (or rely on crypto lib)
- expiry logic
- revoke logic
- JSON contract validator for ReportContent

### 7.2 Integration Tests

Owner flow:
- create share → returns URL
- open share URL as anon → 200 renders report sections

Failure flows:
- revoked token → 404
- expired token → 404
- non-owner cannot create share → 404 or 403 (your policy)
- missing artifact → 404
- invalid JSON contract → 404 or safe "unavailable"

### 7.3 Regression Gates

CI must fail if:
- shared route tries to query chunk tables
- shared route writes to evaluation tables
- A6 credibility fields missing on shared report for completed job

---

## 8. Metrics & Observability

### 8.1 Product Metrics (market validation)

- `shares_created_total`
- `share_views_total`
- `unique_viewers_estimate` (privacy-safe; optional)
- `share_revoked_total`
- `share_expired_total`
- `report_time_to_first_share` (from job completion)

### 8.2 Reliability Metrics

- `share_view_success_rate`
- `share_view_fail_closed_rate` (expected small but non-zero)
- `p95 / p99 share_view_latency`
- `artifact_load_error_rate` (should be ~0; fail-closed instead)

### 8.3 Security Signals

- `invalid_token_rate` (abuse signal)
- `view_rate_per_token` anomalies
- `create_rate_per_user` anomalies

---

## 9. SLO / SLA (A7)

You cannot promise "no errors," but you can promise "no incorrectness."

### 9.1 Safety SLO (Primary)

- 0 data leaks (non-negotiable)
- 0 recompute paths in shared view
- 0 mutation paths from shared routes

### 9.2 Availability SLO (Secondary)

For share view route:
- 99.9% monthly availability (target)
- p95 < 800ms, p99 < 2s (target, adjust after baseline)

### 9.3 Correctness SLO (Primary UX)

99.99% of successful share renders must include:
- overall score
- rubric breakdown
- confidence section
- provenance section

If missing → treat as defect and block via CI in next gate.

---

## 10. A8 Dependency Notes (Scaling)

A7 teaches you real-world access patterns:
- bursty external reads
- high cache hit potential
- tokens becoming "traffic amplifiers"

A8 (batch submissions) increases:
- job volume
- artifact writes
- report reads

A7 MUST be built to withstand:
- high read fan-out on a single report
- shared link posted to large groups

Scaling patterns:
- CDN cache for shared HTML (if safe; must be token-safe)
- server-side memoization per token_hash short TTL
- strict rate limits + WAF for token abuse

---

## 11. Definition of Done (A7)

Gate A7 is CLOSED when:

- Owners can create share links for a completed job
- Anon visitors can view a read-only report via token
- Token validation is hashed + fail-closed
- Revocation works immediately
- Expiration works
- Shared view reads only from `evaluation_artifacts`
- Shared view never mutates evaluation data
- CI includes unit + integration tests enforcing all above
- Closure doc contains CI evidence and proof links

**Next gate:** A8 — Flow 2 Batch / Multi-Submission
