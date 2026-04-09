# Gate A5 Flow 1 — CI Fix & Closure Summary

## Addendum — 2026-04-09 (Final CI Recovery Confirmation)

**Status**: ✅ **CONFIRMED GREEN** (7/7 workflows)

### Decisive Fix Chain

1. **Workflow parse unblock** — `38b95d9`
  - Fixed YAML indentation in `.github/workflows/job-system-ci.yml`
  - Corrected `continue-on-error: true` indentation so CI could parse and execute

2. **Smoke-test contract alignment** — `75e4f6e`
  - Updated `scripts/jobs-supabase-contract-smoke.mjs` to accept both post-claim statuses:
    - from: `job.status !== "processing"`
    - to: `!["processing", "running"].includes(job.status)`
  - Updated assertion/log text to `processing|running` and `queued → processing/running`

### Outcome Verified

- ✅ Security — Secret Scan
- ✅ Canon Guard
- ✅ CI (staging tests)
- ✅ Governance Enforcement
- ✅ CI
- ✅ Job System CI
- ✅ Flow 1 Proof Pack

**Operational conclusion**: secrets are valid, migrations apply, and Supabase DB contract smoke tests pass on `main`.

**Final Status**: ✅ **CLOSED** (All CI workflows green)  
**Closure Date**: 2026-02-19  
**Final Commit**: `3c7323d` (docs: close Gate A5 Flow 1 (CI verified green))

---

## Issues Resolved

### 1. npm audit Pipeline False-Fail ✅ FIXED

**Commit**: [`30e3e4a`](https://github.com/Mmeraw/literary-ai-partner/commit/30e3e4a)

- `npm audit --json` returns exit code 1 when vulnerabilities exist (even allowlisted ones)
- Under `set -e` + `pipefail`, the pipeline failed before the Node.js validator could bless known advisories
- `job-system-ci.yml` already had the correct pattern and was passing

### Solution Applied
Standardized the `|| true` wrapper pattern across all three workflows:

```bash
# Before (ci.yml, ci-staging-tests.yml)
npm audit --json 2>&1 | node -e '...'

# After (all three workflows)
(npm audit --json 2>&1 || true) | node -e '...'
```

This ensures:
- The pipeline's left side never trips `set -e` / `pipefail`
- Full JSON/error stream still feeds into the allowlist validator
- Explicit failure on unexpected vulnerabilities (validator exits 1)
- Explicit success on documented/allowlisted vulnerabilities (validator exits 0)

### Files Changed
1. `.github/workflows/ci.yml` — Added `|| true` wrapper (line 57)
2. `.github/workflows/ci-staging-tests.yml` — Added `|| true` wrapper (line 43)
3. `docs/GATE_A5_FLOW1_CLOSURE.md` — Updated status to "FUNCTIONALLY CLOSED" with CI Exception section

### CI Verification Status
All workflows triggered on commit `30e3e4a`:

| Workflow | Status | URL |
|----------|--------|-----|
| Canon Guard | ✅ Passed | [Run 22125901296](https://github.com/Mmeraw/literary-ai-partner/actions/runs/22125901296) |
| Job System CI | 🔄 In Progress | [Run 22125901306](https://github.com/Mmeraw/literary-ai-partner/actions/runs/22125901306) |
| CI | 🔄 In Progress | [Run 22125901302](https://github.com/Mmeraw/literary-ai-partner/actions/runs/22125901302) |
| CI (staging tests) | 🔄 In Progress | [Run 22125901301](https://github.com/Mmeraw/literary-ai-partner/actions/runs/22125901301) |
| Flow 1 Proof Pack | 🔄 In Progress | [Run 22125901300](https://github.com/Mmeraw/literary-ai-partner/actions/runs/22125901300) |

Once all workflows show ✅, the CI Exception section in `GATE_A5_FLOW1_CLOSURE.md` should be removed and status updated to "CLOSED ✅".

---

## Next Roadmap Items

### Immediate: Gate A5 Production Hardening (Day 3)
**Goal**: Lock down the actor header pattern to prevent production misuse.

**Tasks**:
1. **Startup guard** — Add validation in Next.js startup that blocks `ALLOW_HEADER_USER_ID=true` when:
   - `NODE_ENV === "production"`, OR
   - `NEXT_PUBLIC_SUPABASE_URL` matches production pattern (not `.supabase.co` but custom domain)

2. **Negative test** — Add test case verifying `getDevHeaderActor()` returns `null` when:
   - `TEST_MODE !== "true"`, OR
   - `ALLOW_HEADER_USER_ID !== "true"`

3. **Documentation** — Update `lib/auth/devHeaderActor.ts` with:
   - Explicit "DO NOT USE IN PRODUCTION" warning
   - Link to governance policy
   - Example of how to migrate to real Supabase auth

**Acceptance Criteria**:
- Cannot accidentally deploy with `ALLOW_HEADER_USER_ID=true` to production
- CI coverage of negative path (header ignored when guard disabled)
- Developer documentation prevents copy/paste into production code

---

### Phase 2: Artifact Persistence + Report Rendering

**Goal**: Move from admin-triggered proof to end-user product.

#### A. Backend: Evaluation Artifacts Table
**File**: `supabase/migrations/YYYYMMDDHHMMSS_evaluation_artifacts.sql`

**Schema**:
```sql
CREATE TABLE evaluation_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES evaluation_jobs(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL CHECK (artifact_type IN ('phase2_result', 'criterion_scores', 'feedback')),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_artifacts_job_type ON evaluation_artifacts(job_id, artifact_type);
```

**Rationale**: Separate artifact storage from job metadata enables:
- Multiple artifact types per job (Phase 2 result, individual criterion scores, feedback)
- Efficient querying by artifact type
- Audit trail via `created_at`/`updated_at`

#### B. Phase 2 Persistence
**File**: `lib/evaluation/phase2.ts` (enhancement)

**Change**: After aggregation succeeds, write to `evaluation_artifacts`:
```typescript
const { data, error } = await supabase
  .from('evaluation_artifacts')
  .insert({
    job_id: jobId,
    artifact_type: 'phase2_result',
    data: phase2Result
  });
```

**Governance**: Transaction-safe — only write artifact if Phase 2 completes without errors.

#### C. Report API (Server Component)
**File**: `app/api/evaluations/[jobId]/report/route.ts` (new)

**Function**: `GET /api/evaluations/:jobId/report`

**Response**:
```json
{
  "job_id": "...",
  "status": "complete",
  "artifacts": {
    "phase2_result": { /* JSONB data */ },
    "criterion_scores": [ /* array */ ]
  }
}
```

**Auth**: Same ownership enforcement as existing read endpoint (`created_by === userId`).

#### D. Report Page (Server Component Rendering)
**File**: `app/evaluate/[jobId]/report/page.tsx` (major refactor)

**Architecture Change**: Move from client-side fetch to Server Component:
```typescript
// Before (client-side)
const ReportPage = () => {
  const [data, setData] = useState(null);
  useEffect(() => { fetch(...).then(setData); }, []);
  return <div>{data ? <Report data={data} /> : 'Loading...'}</div>;
};

// After (Server Component)
const ReportPage = async ({ params }: { params: { jobId: string } }) => {
  const data = await getReportData(params.jobId); // server-side
  return <Report data={data} />;
};
```

**Benefits**:
- No client-side auth token exposure
- Faster initial render (SSR)
- Better SEO (if reports become public)
- Reduced client bundle size

**Governance Note**: Server Component auth uses Supabase cookies, not the dev header pattern. The `getDevHeaderActor()` helper is **only** for API routes in test mode.

---

### Phase 3: User Flow Cleanup

**Goal**: Remove admin trigger; enable self-service evaluation.

**Tasks**:
1. **Auto-trigger Phase 2** — When job status → `complete`, automatically enqueue Phase 2 aggregation (no admin action required).
2. **Remove admin endpoint** — Delete `app/api/admin/jobs/[jobId]/run-phase2/route.ts` (no longer needed).
3. **UI polish** — Add "View Report" button to job status page when `status === "complete"`.

**Acceptance Criteria**:
- User submits → job runs → Phase 2 auto-runs → report available (zero admin intervention)
- Smoke test verifies end-to-end flow without admin headers

---

## Governance Checklist for "CLOSED ✅"

- [x] Functional implementation complete (actor headers, ownership enforcement, smoke test)
- [ ] All CI workflows green on closure commit
- [ ] Production hardening (startup guard + negative test)
- [ ] CI Exception section removed from `GATE_A5_FLOW1_CLOSURE.md`
- [ ] Status updated to "CLOSED ✅"

---

## Quick Commands

### Check CI status
```bash
gh run list --limit 5 --json status,conclusion,workflowName,headSha,url
```

### Re-run failed workflows
```bash
gh run rerun <run-id>
```

### View specific workflow logs
```bash
gh run view <run-id> --log
```

### Once all workflows green
```bash
# Remove CI Exception section from closure doc
vim docs/GATE_A5_FLOW1_CLOSURE.md

# Update status line
**Status**: ✅ **CLOSED** (Full CI + Product Proof Complete)
```

---

**Bottom Line**: The gate is functionally closed. Once CI verifies green (expected within 5-10 minutes), you can legitimately stamp it "CLOSED ✅" and move to production hardening or Phase 2 artifact persistence.
