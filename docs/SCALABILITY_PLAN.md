# Production Readiness & 100k-User Scalability Plan

This document outlines the completed work and remaining steps to scale the Day-1 Evaluation UI to 100,000+ users.

---

## ✅ Completed: Debug Logging Hygiene

**Problem:** Console logs in job store created noise in CI and would hide real errors at scale.

**Solution:** Implemented opt-in debug logging via environment flags.

### Files
- `lib/jobs/logging.ts` - Debug/error logging helpers
- `lib/jobs/jobStore.memory.ts` - Now uses `debugLog()` instead of `console.log()`

### Usage
```bash
# Silent by default (clean CI, quiet prod)
npm test

# Enable debug logs when needed
JOBS_DEBUG=1 npm test
REVISIONGRADE_DEBUG=1 npm run dev
```

---

## 🔒 Production Safety Guards (Ready to Use)

**File:** `lib/jobs/guards.ts`

### 1. Memory Store Protection
```typescript
assertNotProductionMemoryStore()
```
Prevents memory store usage in production. Will fail fast with clear error.

**Status:** Implemented, ready to wire into store initialization

### 2. Rate Limit Configuration
Constants defined for 100k-user scale:
- Job creation: 10 per user per hour
- Max manuscript size: 5MB
- Polling backoff thresholds (30s/2min/10s)

**Status:** Defined, needs enforcement layer

---

## 🚀 Critical Path to 100k Users

### Priority 1: Replace Memory Store in Production ⚠️

**Current Risk:** Memory store is not durable or concurrent-safe.

**Action Required:**
1. Ensure Supabase/Postgres job store is implemented
2. Wire `assertNotProductionMemoryStore()` into store initialization
3. Set `USE_SUPABASE_JOBS=true` in production env
4. Add integration tests for DB store

**Timeline:** Must be done before ANY production traffic

---

### Priority 2: Implement Polling Backoff

**Current:** UI polls every 2 seconds indefinitely  
**Risk:** 10k concurrent users = 5k requests/second to `/api/jobs`

**Solution:** Adaptive polling in `useJobs.tsx`

```typescript
// Pseudo-code for backoff
const getPollingInterval = (jobCreatedAt: Date) => {
  const elapsedSeconds = (Date.now() - jobCreatedAt.getTime()) / 1000;
  
  if (elapsedSeconds < 30) return 2000;   // Fast: 2s
  if (elapsedSeconds < 120) return 5000;  // Medium: 5s
  return 10000;                            // Slow: 10s
};
```

**Timeline:** Recommended before 1,000 concurrent users

---

### Priority 3: Rate Limiting on API Endpoints

**Endpoints to protect:**
- `POST /api/jobs` (job creation)
- `GET /api/jobs` (list jobs)
- `GET /api/jobs/[id]` (single job)

**Implementation Options:**
1. Use middleware (e.g., `next-rate-limit`, `express-rate-limit`)
2. Use edge/CDN rate limiting (Vercel, Cloudflare)
3. Custom Redis-backed rate limiter

**Config:** Use constants from `lib/jobs/guards.ts`

**Timeline:** Before 5,000 daily active users

---

### Priority 4: Request Validation & Size Limits

**Add to `POST /api/jobs`:**
```typescript
// Reject empty manuscripts
if (!manuscriptText?.trim()) {
  return NextResponse.json({ error: "Empty manuscript" }, { status: 400 });
}

// Enforce size limit
if (manuscriptText.length > RATE_LIMITS.MAX_MANUSCRIPT_SIZE) {
  return NextResponse.json({ error: "Manuscript too large" }, { status: 413 });
}
```

**Timeline:** Before public launch

---

## 📊 Monitoring Recommendations

### Key Metrics to Track
1. **Job throughput** - Jobs created/completed per minute
2. **Queue depth** - Number of queued jobs
3. **Phase latency** - Time in Phase 1 and Phase 2
4. **API response time** - P50, P95, P99 for `/api/jobs`
5. **Error rate** - Failed jobs, API errors
6. **Concurrent users** - Active sessions

### Observability Stack (Future)
- Application logs → Structured JSON
- Metrics → Prometheus/Grafana or Datadog
- Traces → OpenTelemetry (if needed)
- Alerts → PagerDuty/Opsgenie for critical paths

---

## 🧪 Load Testing Plan

Before claiming "100k-user ready," run:

### Phase 1: Baseline (100 users)
- Concurrent job submissions
- Measure API latency, DB load
- Verify no memory leaks

### Phase 2: Stress (1,000 users)
- Sustained polling load
- DB connection pool sizing
- Identify bottlenecks

### Phase 3: Spike (10,000 users)
- Sudden traffic spike
- Graceful degradation
- Error handling under load

### Phase 4: Soak (10k users, 24 hours)
- Memory stability
- Connection leaks
- Slow degradation over time

---

## 📝 Checklist: Production Readiness

- [x] Debug logging gated behind env flags
- [x] Production safety guards implemented
- [x] Rate limit constants defined
- [ ] Memory store replaced with durable DB store
- [ ] `assertNotProductionMemoryStore()` wired up
- [ ] Polling backoff implemented in UI
- [ ] Rate limiting on API endpoints
- [ ] Manuscript size validation
- [ ] Load testing completed
- [ ] Monitoring/alerting configured

---

## 🎯 Current Status

**Scale Ceiling:** ~100 concurrent users (memory store limit)  
**Next Milestone:** 1,000 concurrent users (requires DB store + polling backoff)  
**Goal:** 100,000 users (requires all Priority 1-4 items + load testing)

---

## 📚 References

- Job System: `lib/jobs/`
- UI Contract: `docs/jobs/UI_CONTRACT.md`
- Production Readiness: `docs/jobs/PRODUCTION_READINESS.md`
- Day-1 Implementation: `docs/DAY1_TRACK_A_IMPLEMENTATION.md`
