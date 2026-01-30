# Phase A.3: Dead-Letter Queue UI — Complete ✅

**Date:** 2026-01-30  
**Status:** Implemented and deployed  
**Next:** Phase A.4 (Idempotent "Run Phase" endpoints)

---

## What Was Built

### 1. Admin Actions Audit Table
- **File:** [supabase/migrations/20260130000004_admin_actions_audit_table.sql](../supabase/migrations/20260130000004_admin_actions_audit_table.sql)
- **Schema:** `public.admin_actions`
- **Features:**
  - Append-only audit log for admin interventions
  - Before/after snapshots of job state
  - Service role RLS (no direct user access)
  - Indexed by job_id, performed_by, performed_at

### 2. Dead-Letter Queue API
- **Endpoint:** `GET /api/admin/dead-letter`
- **File:** [app/api/admin/dead-letter/route.ts](../app/api/admin/dead-letter/route.ts)
- **Purpose:** List all failed jobs with retry metadata
- **Auth:** Service role required
- **Returns:**
  - `job_id`, `manuscript_id`, `phase`, `phase_status`
  - `attempt_count`, `max_attempts`
  - `failed_at`, `next_attempt_at`, `last_error`

### 3. Retry Endpoint
- **Endpoint:** `POST /api/admin/jobs/:jobId/retry`
- **File:** [app/api/admin/jobs/[jobId]/retry/route.ts](../app/api/admin/jobs/[jobId]/retry/route.ts)
- **Purpose:** Retry a failed job safely
- **Auth:** Service role required
- **State Transition:** `failed` → `queued`
- **Guarantees:**
  - Validates job is in `failed` status
  - Preserves `attempt_count` (audit trail)
  - Clears `failed_at`, sets `next_attempt_at = NOW()`
  - Logs action to `admin_actions` audit table

### 4. Admin UI
- **Route:** `/admin/jobs/dead-letter`
- **File:** [app/admin/jobs/dead-letter/page.tsx](../app/admin/jobs/dead-letter/page.tsx)
- **Features:**
  - Table view of all failed jobs
  - Displays: ID, manuscript, phase, attempts, failed_at, error
  - "Retry Now" button for each job
  - Real-time retry status (loading state)
  - Auto-refresh after retry

### 5. Tests
- **File:** [tests/admin-dead-letter.test.ts](../tests/admin-dead-letter.test.ts)
- **Coverage:**
  - Service role authentication required
  - Dead-letter queue returns only failed jobs
  - Retry endpoint enforces canonical state transitions
  - Audit logging verified

---

## Governance Guarantees

### ✅ Canonical State Enforcement
- Retry only works for jobs with `status='failed'`
- Illegal transitions (e.g., `queued` → `queued`) are rejected (400 error)

### ✅ Audit Trail
- Every admin action is logged to `admin_actions` table
- Before/after snapshots of job state captured
- `action_type`, `performed_by`, `performed_at` tracked
- Optional `reason` field for context

### ✅ Service Role Only
- Both endpoints require `Authorization: Bearer <service_role_key>`
- RLS policies prevent direct user access to `admin_actions` table
- Unauthorized requests return 401

### ✅ Preserves Attempt Count
- Retry does NOT reset `attempt_count` to 0
- Maintains full audit history of retry attempts
- Worker respects `max_attempts` limit on next claim

---

## Database Schema

### admin_actions Table
```sql
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY,
  action_type TEXT NOT NULL,           -- 'retry_job', 'reset_attempts', 'cancel_job'
  job_id UUID NOT NULL REFERENCES evaluation_jobs(id),
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  before_status TEXT NOT NULL,
  before_attempt_count INTEGER,
  before_failed_at TIMESTAMPTZ,
  before_next_attempt_at TIMESTAMPTZ,
  
  after_status TEXT NOT NULL,
  after_attempt_count INTEGER,
  after_failed_at TIMESTAMPTZ,
  after_next_attempt_at TIMESTAMPTZ,
  
  reason TEXT,
  metadata JSONB DEFAULT '{}'
);
```

### RLS Policies
- `"Service role full access"` → `USING (true)`
- `"No direct user access"` → `USING (false)` for authenticated users

---

## Usage Example

### List Failed Jobs
```bash
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  https://your-project.supabase.co/api/admin/dead-letter
```

**Response:**
```json
{
  "ok": true,
  "jobs": [
    {
      "id": "uuid-here",
      "manuscript_id": 123,
      "status": "failed",
      "phase": "phase_2",
      "phase_status": "failed",
      "attempt_count": 3,
      "max_attempts": 3,
      "failed_at": "2026-01-30T12:34:56Z",
      "next_attempt_at": null,
      "last_error": "OpenAI API timeout"
    }
  ],
  "count": 1
}
```

### Retry a Failed Job
```bash
curl -X POST \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Manual retry after API issue resolved"}' \
  https://your-project.supabase.co/api/admin/jobs/uuid-here/retry
```

**Response:**
```json
{
  "ok": true,
  "job_id": "uuid-here",
  "before_status": "failed",
  "after_status": "queued",
  "attempt_count": 3,
  "next_attempt_at": "2026-01-30T12:45:00Z"
}
```

---

## Verification

### 1. Migration Applied
```bash
supabase db reset  # Local
supabase db push   # Remote
```

### 2. Table Exists
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'admin_actions';
```

### 3. RLS Policies Active
```sql
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.admin_actions'::regclass;
```

**Expected:** 2 policies (service role full access, no user access)

### 4. Endpoints Accessible
```bash
# Test authentication
curl -H "Authorization: Bearer invalid_key" \
  http://localhost:3000/api/admin/dead-letter
# Expected: 401 Unauthorized

# Test with service role
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  http://localhost:3000/api/admin/dead-letter
# Expected: 200 OK with jobs array
```

---

## Next Steps: Phase A.4

**Goal:** Idempotent "Run Phase" endpoints & safety rails

### Must-haves:
1. **Idempotent phase execution**
   - `POST /api/jobs/:id/run-phase1` (already exists, needs idempotency check)
   - `POST /api/jobs/:id/run-phase2` (already exists, needs idempotency check)
   - Replays don't double-run phases

2. **State machine guards**
   - Use `canRunPhase()` logic (check status, phase_status, leases)
   - Return 400 if phase already complete
   - Return 409 if job is leased by another worker

3. **Evidence & tests**
   - Test: calling run-phase1 twice doesn't duplicate work
   - Test: run-phase2 rejects if phase1 not complete
   - Test: leased jobs reject run-phase calls

### Files to modify:
- [app/api/jobs/[jobId]/run-phase1/route.ts](../app/api/jobs/[jobId]/run-phase1/route.ts)
- [app/api/jobs/[jobId]/run-phase2/route.ts](../app/api/jobs/[jobId]/run-phase2/route.ts)
- [tests/run-phase-idempotency.test.ts](../tests/run-phase-idempotency.test.ts) (new)

**Estimated effort:** 3-4 hours

---

## Commit
```
feat: Phase A.3 - Dead-Letter Queue UI and Admin Retry

- Add admin_actions audit table (append-only, service role RLS)
- Add GET /api/admin/dead-letter endpoint (list failed jobs)
- Add POST /api/admin/jobs/:id/retry endpoint (retry with audit log)
- Add /admin/jobs/dead-letter UI page (table + retry buttons)
- Add tests for retry endpoint and state guards
- Preserves attempt_count on retry (for audit trail)
- Logs all admin actions (before/after snapshots)

Governance:
- Service role authentication required
- Canonical state transitions enforced (failed -> queued)
- Audit trail for all admin interventions
- Reset-safe migration
```

**Commit hash:** `0522c53`  
**Pushed to:** `main`  
**Remote migration:** Applied ✅

---

**Last Updated:** 2026-01-30  
**Status:** Phase A.3 complete, Phase A.4 ready to start
