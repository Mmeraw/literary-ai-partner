# Phase A.1 Complete: Structured Error Envelopes

**Date:** 2026-01-30  
**Status:** ✅ Shipped  
**Commit:** ec05a71

---

## What Shipped

**Structured error handling for Phase 2 job failures** — every error is now captured with:
- Error code (`RATE_LIMIT`, `TIMEOUT`, `INVALID_INPUT`, etc.)
- Retryability classification (enables bounded retry)
- Human-readable message
- Full context (job ID, manuscript ID, provider, phase)
- Timestamp

---

## Files Added

1. **`lib/errors/errorEnvelope.ts`** — Canonical error envelope type
   - `ErrorEnvelopeV1` interface
   - `classifyError()` — maps any error to a code + retryability
   - `toErrorEnvelope()` — converts exceptions to envelopes
   - 11 error codes with clear semantics

2. **`__tests__/errorEnvelope.test.ts`** — 16 passing tests
   - Rate limits → retryable ✅
   - Timeouts → retryable ✅
   - Auth failures → non-retryable ✅
   - Invalid input → non-retryable ✅

---

## Files Modified

1. **`lib/jobs/jobStore.supabase.ts`**
   - Added `setJobFailed(jobId, envelope)` function
   - Persists to `evaluation_jobs.last_error` (JSONB)
   - Sets `status = 'failed'` + `phase_status = 'failed'`

2. **`lib/jobs/store.ts`**
   - Exported `setJobFailed` for worker use

3. **`workers/phase2Worker.ts`**
   - Catch block now creates error envelope
   - Calls `setJobFailed()` before returning
   - Logs retryability classification

---

## What This Enables (Next Tasks)

### Week 1, Task 2 (Next): Bounded Retry Policy
- Add `attempt_count`, `max_attempts`, `next_attempt_at` to schema
- Worker checks `envelope.retryable` before retrying
- Exponential backoff (30s, 90s, 270s)

### Week 1, Task 3: Dead-Letter Queue UI
- Admin page: `/admin/failed-jobs`
- Query `WHERE status = 'failed'`
- Display error code, message, retryability

### Week 2: Observability
- Dashboard: top 10 error codes by frequency
- Alert: failure rate > 10%

---

## Testing Evidence

```bash
Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

All error classifications validated:
- ✅ OpenAI 429 → `RATE_LIMIT` (retryable)
- ✅ Timeout → `TIMEOUT` (retryable)
- ✅ Network error → `NETWORK_ERROR` (retryable)
- ✅ 5xx → `SERVER_ERROR` (retryable)
- ✅ 401/403 → `AUTH_FAILED` (non-retryable)
- ✅ 400 → `INVALID_INPUT` (non-retryable)
- ✅ Quota → `QUOTA_EXCEEDED` (non-retryable)

---

## Behavior Change

**Before:** Phase 2 failure → logged error, generic `last_error` string  
**After:** Phase 2 failure → structured envelope in DB, retryability known

**Example `last_error` value:**
```json
{
  "code": "RATE_LIMIT",
  "message": "API rate limit exceeded: 429 Too Many Requests",
  "retryable": true,
  "phase": "phase_2",
  "provider": "openai",
  "context": {
    "jobId": "abc-123",
    "manuscriptId": 456
  },
  "occurred_at": "2026-01-30T04:00:00.000Z"
}
```

This JSON is **machine-parseable** (retry logic) and **human-readable** (admin UI).

---

## Next Steps

1. **Add retry tracking columns** (migration)
2. **Implement bounded retry** (worker logic)
3. **Build admin failed-jobs UI** (Next.js page)

**Estimated time to complete Week 1:** 10-12 hours remaining.

---

## References

- [Phase A Roadmap](./PHASE_A_JOB_RELIABILITY.md)
- [Week 1 Status](./PHASE_A_WEEK1_STATUS.md)
- [Job Contract](./JOB_CONTRACT_v1.md)
