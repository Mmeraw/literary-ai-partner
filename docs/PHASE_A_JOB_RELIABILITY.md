# Phase A: Job Reliability Implementation

**Status:** ✅ Phase A.1-A.4 Complete | 🚧 A.5 Next (Production Hardening)  
**Start Date:** 2026-01-30  
**Current Date:** 2026-01-30  
**Goal:** Every job either completes correctly or fails transparently

---

## Why This Matters

Agents and publishers don't forgive silent failures. This phase transforms RevisionGrade from "impressive tech" into "safe to depend on."

**Core Principle:** Jobs should never disappear or hang indefinitely. Clear outcomes, always.

---

## Implementation Order

### ✅ A.1: Structured Error Envelopes (Complete)
**Status:** Shipped 2026-01-30  
**Doc:** [PHASE_A1_COMPLETE.md](PHASE_A1_COMPLETE.md)

- ✅ Error classification (11 error codes)
- ✅ Retryability detection
- ✅ `setJobFailed()` with envelope persistence
- ✅ 16 passing tests

### ✅ A.2: Retry Logic with Exponential Backoff (Complete)
**Status:** Shipped 2026-01-30  
**Doc:** [PHASE_A2_STATUS.md](PHASE_A2_STATUS.md)

- ✅ `attempt_count`, `max_attempts` columns
- ✅ `next_attempt_at`, `failed_at` tracking
- ✅ `claim_job_atomic` retry gate
- ✅ Bounded retry with backoff
- ✅ 18 passing tests

### ✅ A.3: Dead-Letter Queue + Admin Retry (Complete)
**Status:** Shipped 2026-01-30  
**Doc:** [PHASE_A3_DEAD_LETTER_COMPLETE.md](PHASE_A3_DEAD_LETTER_COMPLETE.md)

- ✅ `admin_actions` audit table
- ✅ `GET /api/admin/dead-letter` endpoint
- ✅ `POST /api/admin/jobs/:jobId/retry` endpoint
- ✅ `/admin/jobs/dead-letter` UI
- ✅ Manual retry with audit trail

### ✅ A.4: Observability & Operator Confidence (Complete)
**Status:** Shipped 2026-01-30  
**Doc:** [PHASE_A4_OBSERVABILITY.md](PHASE_A4_OBSERVABILITY.md)

- ✅ Diagnostics query layer (`lib/jobs/diagnostics.ts`)
- ✅ `GET /api/admin/diagnostics` endpoint
- ✅ `/admin/diagnostics` dashboard UI
- ✅ Real-time metrics (jobs by status, failed 24h, avg time, retry rate)
- ✅ Phase timing (P50/P95)
- ✅ Recent failures with error details

### 🚧 A.5: Production Hardening (Next)
**Target:** Week 2

**Planned Deliverables:**
- [ ] Rate limiting (API endpoints, provider calls)
  - Use `manuscript_chunks` lease expiry for crash recovery
  - Check `job_id` to avoid re-chunking completed manuscripts
- [ ] Phase 2 retry logic (evaluation calls)
  - Use `evaluation_provider_calls` uniqueness constraint
  - Check `(job_id, provider, phase)` before making external calls
- [ ] Worker lease renewal for long-running jobs
  - Call `renew_lease` RPC every 30 seconds during processing
  - Auto-fail jobs with expired leases after grace period

**Success Criteria:**
- Worker crash mid-job → another worker picks up within 60s
- Network glitch during API call → retry succeeds without duplicate charges
- Long manuscript (10min process) → lease stays valid throughout

---

### 2. Dead-Letter Path (Week 1-2)

**Objective:** Failed jobs are visible, not buried.

**Schema Already Exists:**
```sql
evaluation_jobs.status  -- 'queued' | 'running' | 'complete' | 'failed'
evaluation_jobs.last_error -- JSON error details
```

**Deliverables:**
- [ ] Worker error handling
  - Catch all exceptions during job processing
  - Write structured error to `last_error`
  - Transition status to `'failed'`
- [ ] Admin UI for failed jobs
  - Dashboard: jobs grouped by status
  - Filter by error type/provider
  - Manual retry button for recoverable failures

**Success Criteria:**
- OpenAI rate limit → job marked `'failed'` with clear reason
- Invalid manuscript format → job fails with actionable error message
- Admin can see all failed jobs from past 7 days

---

### 3. Structured Failure Envelopes (Week 2)

**Objective:** Error reasons are human-readable AND machine-parseable.

**Error Envelope Schema:**
```typescript
interface JobError {
  code: string;           // 'RATE_LIMIT' | 'INVALID_INPUT' | 'PROVIDER_ERROR' | ...
  message: string;        // Human-readable description
  provider?: string;      // 'openai' | 'anthropic' | null
  phase?: 1 | 2;         // Which phase failed
  retryable: boolean;    // Can this be auto-retried?
  timestamp: string;     // ISO 8601
  details?: unknown;     // Provider-specific context
}
```

**Deliverables:**
- [ ] Error classification system
  - Map provider errors to standard codes
  - Determine retryability per error type
- [ ] Persist to `evaluation_jobs.last_error` as JSONB
- [ ] Client-facing error messages
  - User-friendly wording (no stack traces)
  - Suggested actions when applicable

**Success Criteria:**
- OpenAI 429 → `{ code: 'RATE_LIMIT', retryable: true, ... }`
- Invalid UTF-8 in manuscript → `{ code: 'INVALID_INPUT', retryable: false, ... }`
- Generic network error → `{ code: 'NETWORK_ERROR', retryable: true, ... }`

---

### 4. Bounded Retry Policy (Week 2-3)

**Objective:** Failed jobs retry automatically, but don't loop forever.

**Policy Design:**
```typescript
const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffStrategy: 'exponential', // 30s, 90s, 270s
  retryableErrors: [
    'RATE_LIMIT',
    'NETWORK_ERROR',
    'TIMEOUT',
    'PROVIDER_UNAVAILABLE'
  ],
  nonRetryableErrors: [
    'INVALID_INPUT',
    'AUTH_FAILED',
    'QUOTA_EXCEEDED'
  ]
};
```

**Deliverables:**
- [ ] Add retry tracking to `evaluation_jobs`
  ```sql
  ALTER TABLE evaluation_jobs ADD COLUMN attempt_count INTEGER DEFAULT 0;
  ALTER TABLE evaluation_jobs ADD COLUMN max_attempts INTEGER DEFAULT 3;
  ```
- [ ] Worker retry orchestration
  - Check `attempt_count < max_attempts` before retrying
  - Implement exponential backoff (via job queue or sleep)
  - Mark job `'failed'` after max attempts exhausted
- [ ] Lease-aware retry
  - Don't retry if lease expired (let crash recovery handle it)
  - Renew lease before each retry attempt

**Success Criteria:**
- Transient network error → auto-retry after 30s, succeeds
- 3x rate limit errors → job marked `'failed'` after 3 attempts
- Worker crashes during retry #2 → another worker picks up retry #3

---

## Monitoring & Observability

**Key Metrics (Phase A.5, Week 3-4):**
- Job success rate (by provider, by phase)
- Average retry count before success
- Top 10 failure reasons (last 7 days)
- Jobs stuck in `'running'` > 10 minutes
- Lease expiry rate (crash detection)

**Implementation:**
- SQL queries for dashboards (lightweight, no external deps yet)
- Daily reports via cron (email digest)
- Slack alerts for critical failures (> 10% failure rate)

---

## Testing Strategy

**Unit Tests:**
- [ ] Retry logic with mocked failures
- [ ] Error envelope serialization/deserialization
- [ ] Lease renewal during long operations

**Integration Tests:**
- [ ] Simulate OpenAI rate limit → verify retry + backoff
- [ ] Kill worker mid-job → verify lease expiry + recovery
- [ ] Invalid manuscript → verify non-retryable failure path

**Load Tests:**
- [ ] 100 concurrent jobs with 10% failure rate
- [ ] Verify no job hangs or disappears
- [ ] Verify retry queue doesn't overflow

---

## Success Criteria (Phase A Complete)

✅ **Reliability Guarantees:**
1. No jobs disappear (every job ends in `'complete'` or `'failed'`)
2. No infinite retries (bounded by `max_attempts`)
3. No silent failures (all errors logged + visible)
4. No duplicate work (idempotency via leases + uniqueness constraints)

✅ **Operational Visibility:**
1. Admin can answer: "Why did this job fail?"
2. System can answer: "Is the job queue healthy?"
3. Users see: "Your evaluation is processing" or "Failed due to [reason]"

✅ **Developer Confidence:**
1. Tests prove retry logic works
2. Dashboards show real-time job health
3. Documentation explains failure modes

---

## Next Phase (Phase B: Product Differentiation)

After Phase A completes:
- **Canonical Evaluation Profiles** (agent-ready, screenplay, dev edit)
- **StoryGate Studio Expansion** (continuity, character consistency)
- **Packaging Automation** (query letter, synopsis, comps)

But **NOT until reliability is bulletproof.**

---

## References

- [Job Contract](./JOB_CONTRACT_v1.md) — Canonical job state definitions
- [Scale Hardening](../SCALE_HARDENING_100K_USERS.md) — Infrastructure foundation
- [Lease Specification](./evaluation_jobs_lease_spec.md) — Concurrency semantics
