# Job System CI Contract

**Last Updated**: January 24, 2026  
**Status**: ✅ Production-ready

## 3-State CI Matrix

The job system tests operate in three distinct modes, each with explicit environment assumptions:

### State 1: Memory Mode (Default CI)

**Environment**:
- `USE_SUPABASE_JOBS=false`
- `ALLOW_HEADER_USER_ID=true`
- No Supabase secrets configured
- No background worker process

**What Runs**:
- ✅ Job creation API contracts
- ✅ Job schema validation
- ✅ Status transitions (queued → running → complete)
- ✅ Rate limiting logic
- ✅ Metrics safety tests
- ✅ Retry backoff validation

**What Skips** (intentional):
- ⏭️ Phase 1 completion (requires worker)
- ⏭️ Phase 2 completion (requires worker + Phase 1→2 transition)
- ⏭️ Lease contention tests (requires worker competition)
- ⏭️ Cancellation tests (requires active worker to cancel)

**Skip Message Format**:
```
⚠️  SKIP: [Test Name]
   Reason: Memory mode detected; requires [infrastructure]
   Mode: USE_SUPABASE_JOBS=false
✅ Skip is intentional and expected for this environment
```

**Purpose**: Fast feedback on API contracts without infrastructure dependencies.

---

### State 2: Supabase Mode Without Secrets (Gated Skip)

**Environment**:
- `USE_SUPABASE_JOBS=true`
- Supabase secrets **not** configured in workflow
- `check-secrets` step detects missing credentials

**What Happens**:
- ⏭️ All Supabase-backed tests skip cleanly
- ℹ️ Diagnostic message: "Supabase credentials not configured – skipping"
- ✅ Job reports success (no red failures)

**Purpose**: Clean degradation when Supabase isn't available; no false negatives.

---

### State 3: Full Supabase Validation (Production Contract)

**Environment**:
- `USE_SUPABASE_JOBS=true`
- All Supabase secrets configured (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)
- Background worker enabled
- `ALLOW_HEADER_USER_ID=true` (for smoke tests)

**What Runs**:
- ✅ All State 1 contract tests
- ✅ Phase 1 full completion with worker
- ✅ Phase 2 full completion with worker
- ✅ Lease acquisition and contention handling
- ✅ Job cancellation with lease cleanup
- ✅ Real Supabase persistence and recovery

**Purpose**: Full integration validation against production-equivalent infrastructure.

---

## Authentication Contract

### Development/CI: `x-user-id` Bypass

**Gate**: `ALLOW_HEADER_USER_ID=true`

When enabled:
```bash
curl -X POST /api/jobs \
  -H "Content-Type: application/json" \
  -H "x-user-id: smoke-test-user" \
  -d '{"job_type": "evaluate_full", "manuscript_id": "test-123"}'
```

**Implementation** ([lib/jobs/rateLimiter.ts](../lib/jobs/rateLimiter.ts)):
```typescript
const allowHeaderUserId = process.env.ALLOW_HEADER_USER_ID === "true";
const isProduction = process.env.NODE_ENV === "production" 
  && process.env.VERCEL_ENV === "production";

// Fail-safe: Never honor header bypass in production
const effectiveUserId = (allowHeaderUserId && !isProduction) ? userId : null;
```

**Production Behavior**:
- `ALLOW_HEADER_USER_ID` is **never** set to `true`
- `x-user-id` header is **always** ignored
- Real authentication required for all job operations

---

## Centralized Test Helpers

### HTTP Wrapper ([scripts/_http.mjs](../scripts/_http.mjs))

```javascript
import { jfetch, must, sleep } from "./_http.mjs";

// Automatic auth headers for POST/PUT/DELETE
const res = await jfetch(`${BASE}/api/jobs`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ job_type: "evaluate_full", manuscript_id: "test" })
});

// Response validation
await must(jfetch(...), "Failed to create job");
```

### Skip Logic ([scripts/_skip.mjs](../scripts/_skip.mjs))

```javascript
import { skipIfMemoryMode } from "./_skip.mjs";

// Standardized skip with audit-grade message
skipIfMemoryMode("Phase 2 smoke test", "Supabase + background worker");
```

---

## CI Failure Interpretation

| Failure Type | Meaning | Action |
|--------------|---------|--------|
| **Red in State 1** | API contract broken | Fix regression in job creation/validation |
| **Red in State 3** | Supabase integration broken | Fix worker, persistence, or lease logic |
| **Skip in State 1** | Expected (no worker) | No action; intentional |
| **Skip in State 2** | Expected (no secrets) | No action; diagnostic only |
| **403 in any state** | `ALLOW_HEADER_USER_ID` not set | Add env var to workflow |

---

## Adding New Job System Tests

### Contract Test (No Worker)
```javascript
import { jfetch, must } from "./_http.mjs";

// Runs in all states
const res = await must(
  jfetch(`${BASE}/api/jobs`, { method: "POST", ... }),
  "Failed to create job"
);
```

### Worker-Dependent Test
```javascript
import { skipIfMemoryMode } from "./_skip.mjs";
import { jfetch, must } from "./_http.mjs";

// Skips in State 1, runs in State 3
skipIfMemoryMode("My Worker Test", "background worker for Phase X");

// Test logic...
```

---

## Related Documentation

- [JOBS_STABILITY_CONTRACT.md](./JOBS_STABILITY_CONTRACT.md) - Job system behavioral invariants
- [CI_INTEGRATION.md](./CI_INTEGRATION.md) - Workflow verification contract
- [NPM_AUDIT_NOTES.md](./NPM_AUDIT_NOTES.md) - Approved vulnerability allowlist

---

## Verification Checklist

Before merging job system changes, verify:

- [ ] State 1 (memory mode) CI passes
- [ ] All worker-dependent tests skip cleanly in State 1
- [ ] No hardcoded auth headers in test scripts (use `jfetch`)
- [ ] Skip messages follow standard format
- [ ] `ALLOW_HEADER_USER_ID` never set to `true` in production env
- [ ] New tests use centralized helpers (`_http.mjs`, `_skip.mjs`)
