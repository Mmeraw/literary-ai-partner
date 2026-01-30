# Phase A.5: Production Hardening — 72-Hour Sprint

**Status:** 📋 Planned  
**Duration:** 72 hours (3 days)  
**Goal:** "Safe to grow" — Protect, measure, and alert

**Previous:** Phase A.4 (Observability)  
**Current:** Phase A.5 (Hardening)  
**Next:** Phase B (Provider Call Execution)

---

## Why This Matters

Phase A.4 gave you **visibility**.  
Phase A.5 gives you **safety at scale**.

Without A.5:
- ❌ Anyone can access admin endpoints
- ❌ No protection from abuse or overload
- ❌ AI spend is invisible
- ❌ System can't tell you when it's sick

With A.5:
- ✅ Admin-only access enforced
- ✅ Rate limits prevent abuse
- ✅ Backpressure prevents cascading failure
- ✅ Cost visibility enables forecasting
- ✅ Alerts notify before disaster

**This is the difference between "demo-ready" and "can handle growth."**

---

## Day 1: Protect the System (8 hours)

### 🔒 1. Admin Endpoint Lockdown (4 hours)
**Priority:** **CRITICAL** — Security gap

**Deliverable:** `lib/auth/adminGuard.ts`

```typescript
/**
 * Admin endpoint authentication guard
 * Validates service role or admin user token
 */
export async function validateAdminAccess(request: Request): Promise<{
  authorized: boolean;
  reason?: string;
  userId?: string;
}> {
  // Check service role key
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (token === serviceRoleKey) {
      return { authorized: true, userId: "service-role" };
    }
  }
  
  // Check admin user (future: check roles table)
  // For now: service role only
  return { authorized: false, reason: "Service role required" };
}
```

**Apply to:**
- ✅ `POST /api/admin/jobs/[jobId]/retry`
- ✅ `GET /api/admin/dead-letter`
- ✅ `GET /api/admin/diagnostics`

**Test:**
```bash
# Should fail (401)
curl http://localhost:3002/api/admin/diagnostics

# Should succeed (200)
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  http://localhost:3002/api/admin/diagnostics
```

**Evidence:** `docs/ADMIN_ENDPOINT_SECURITY.md`

---

### 🛡️ 2. Basic Rate Limiting (4 hours)
**Priority:** HIGH — Abuse protection

**Deliverable:** `lib/rate-limit/limiter.ts`

**Start simple — in-memory token bucket:**

```typescript
/**
 * Simple in-memory rate limiter
 * Per-IP or per-user token bucket
 * 
 * Production: Replace with Redis or Upstash
 */
interface RateLimit {
  limit: number;        // Max requests per window
  window: number;       // Time window (ms)
  cost?: number;        // Cost per request (default 1)
}

export function createRateLimiter(config: RateLimit) {
  const store = new Map<string, { count: number; resetAt: number }>();
  
  return {
    check: (key: string): { allowed: boolean; remaining: number; resetAt: number } => {
      const now = Date.now();
      const entry = store.get(key);
      
      if (!entry || now > entry.resetAt) {
        // New window
        store.set(key, { count: 1, resetAt: now + config.window });
        return { allowed: true, remaining: config.limit - 1, resetAt: now + config.window };
      }
      
      if (entry.count >= config.limit) {
        // Rate limited
        return { allowed: false, remaining: 0, resetAt: entry.resetAt };
      }
      
      // Increment
      entry.count++;
      return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
    }
  };
}
```

**Apply to:**
- `POST /api/evaluate` — 10 requests per minute per user
- `POST /api/jobs` — 20 requests per minute per IP
- `POST /api/admin/jobs/[jobId]/retry` — 5 retries per minute (prevent spam)

**Response on limit:**
```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 45,
  "limit": 10,
  "window": "1 minute"
}
```
**Status code:** `429 Too Many Requests`

**Evidence:** Rate limit metrics in diagnostics dashboard.

---

## Day 2: Backpressure + Resilience (8 hours)

### 🚦 3. Backpressure Policy (4 hours)
**Priority:** HIGH — Prevent self-inflicted outage

**Deliverable:** Queue depth checks + 429 responses

**Policy:**
```typescript
/**
 * Backpressure thresholds
 */
export const BACKPRESSURE_THRESHOLDS = {
  maxQueuedJobs: 100,        // Max jobs in 'queued' status
  maxRunningJobs: 20,        // Max jobs in 'running' status
  maxConcurrentPerUser: 5,   // Max active jobs per user
};

/**
 * Check if system can accept new jobs
 */
export async function canAcceptJob(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  queueDepth?: number;
}> {
  const supabase = createAdminClient();
  
  // Check global queue depth
  const { count: queuedCount } = await supabase
    .from("evaluation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "queued");
  
  if (queuedCount && queuedCount >= BACKPRESSURE_THRESHOLDS.maxQueuedJobs) {
    return {
      allowed: false,
      reason: "System busy, retry later",
      queueDepth: queuedCount,
    };
  }
  
  // Check per-user concurrency
  const { count: userActiveCount } = await supabase
    .from("evaluation_jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["queued", "running"]);
  
  if (userActiveCount && userActiveCount >= BACKPRESSURE_THRESHOLDS.maxConcurrentPerUser) {
    return {
      allowed: false,
      reason: "Too many active jobs for this user",
      queueDepth: userActiveCount,
    };
  }
  
  return { allowed: true };
}
```

**Apply to:**
- `POST /api/evaluate` — Check before creating job
- `POST /api/jobs` — Check before accepting submission

**Observability:**
- Log `backpressure_triggered` event
- Track rejections in diagnostics dashboard
- Alert if sustained backpressure (> 5 min)

**Evidence:** `docs/BACKPRESSURE_POLICY.md`

---

### 💰 4. Cost Visibility (4 hours)
**Priority:** MEDIUM — Investor confidence + FinOps

**Deliverable:** Lightweight provider usage tracking

**Schema:**
```sql
-- supabase/migrations/20260130000005_provider_usage_tracking.sql

CREATE TABLE IF NOT EXISTS public.provider_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,              -- 'openai' | 'anthropic'
  date DATE NOT NULL,                  -- Daily aggregation
  total_calls INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(provider, date)
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_date
  ON public.provider_usage_daily(date DESC);

COMMENT ON TABLE public.provider_usage_daily IS
  'Daily aggregated provider API usage for cost tracking';
```

**Tracking function:**
```typescript
/**
 * Record provider call for cost tracking
 */
export async function recordProviderCall(params: {
  provider: 'openai' | 'anthropic';
  model: string;
  promptTokens: number;
  completionTokens: number;
}) {
  const estimatedCost = calculateCost(params);
  
  // Upsert daily aggregate
  const today = new Date().toISOString().split('T')[0];
  await supabase.rpc('increment_provider_usage', {
    p_provider: params.provider,
    p_date: today,
    p_calls: 1,
    p_tokens: params.promptTokens + params.completionTokens,
    p_cost: estimatedCost,
  });
}
```

**Dashboard addition:**
- Provider spend by day (chart)
- Total spend this month
- Cost per job (avg)

**Evidence:**
- `GET /api/admin/costs` endpoint
- Costs tab in diagnostics dashboard

---

## Day 3: Alerting (8 hours)

### 🚨 5. Threshold Alerts (8 hours)
**Priority:** MEDIUM — Proactive monitoring

**Deliverable:** Alert definitions + delivery mechanism

**Three critical alerts:**

#### Alert 1: Failure Rate Spike
```typescript
{
  name: "failure_rate_spike",
  condition: "failed_jobs_last_1h > 10 OR failure_rate_pct > 10%",
  severity: "high",
  cooldown: "15 minutes",
  message: "Job failure rate elevated: {count} failures in last hour",
}
```

#### Alert 2: Retry Success Rate Drop
```typescript
{
  name: "retry_success_drop",
  condition: "retry_success_rate < 50%",
  severity: "medium",
  cooldown: "30 minutes",
  message: "Retry effectiveness dropping: {rate}% success rate",
}
```

#### Alert 3: P95 Latency Threshold
```typescript
{
  name: "p95_latency_high",
  condition: "p95_duration_ms > 300000",  // 5 minutes
  severity: "medium",
  cooldown: "1 hour",
  message: "P95 processing time exceeds threshold: {duration}",
}
```

**Delivery options (start simple):**
1. **Console logs** (immediate)
   ```typescript
   console.error("[ALERT]", alertEvent);
   ```

2. **Webhook** (MVP++)
   ```typescript
   await fetch(process.env.ALERT_WEBHOOK_URL, {
     method: "POST",
     body: JSON.stringify(alertEvent),
   });
   ```

3. **Slack** (production)
   ```bash
   curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
     -d '{"text": "🚨 Alert: Failure rate spike"}'
   ```

**Implementation:**
```typescript
// lib/alerting/alerts.ts

export async function evaluateAlerts() {
  const snapshot = await getDiagnosticsSnapshot();
  
  // Check each alert condition
  if (snapshot.failedJobsLast24h > 10) {
    await triggerAlert({
      name: "failure_rate_spike",
      severity: "high",
      data: { count: snapshot.failedJobsLast24h },
    });
  }
  
  if (snapshot.retrySuccessRate !== null && snapshot.retrySuccessRate < 50) {
    await triggerAlert({
      name: "retry_success_drop",
      severity: "medium",
      data: { rate: snapshot.retrySuccessRate },
    });
  }
  
  // ... more checks
}

// Run every 5 minutes via cron or worker
```

**Evidence:**
- `docs/ALERTING_RULES.md`
- Alert history in admin dashboard
- Test alert script

---

## Success Criteria

### Day 1 Complete When:
✅ All admin endpoints return 401 without auth  
✅ Service role requests succeed  
✅ Rate limiter rejects excessive requests with 429  
✅ Rate limit headers present in responses

### Day 2 Complete When:
✅ Backpressure policy rejects jobs when queue full  
✅ Per-user concurrency limits enforced  
✅ Provider usage tracked in database  
✅ Cost dashboard shows daily spend

### Day 3 Complete When:
✅ Alert evaluation runs on schedule  
✅ Test alerts trigger correctly  
✅ Alert delivery confirmed (console or webhook)  
✅ Alert history visible in admin UI

---

## Evidence Files

Create these documents:
1. `docs/ADMIN_ENDPOINT_SECURITY.md` — Auth implementation
2. `docs/BACKPRESSURE_POLICY.md` — Queue management rules
3. `docs/ALERTING_RULES.md` — Alert definitions and thresholds
4. `docs/COST_TRACKING.md` — Provider usage methodology

---

## What Phase A.5 Enables

### "Safe to Grow" Confidence
- ✅ Admin actions are secured
- ✅ System protects itself from overload
- ✅ Costs are visible and trackable
- ✅ Problems surface automatically

### Investor Readiness
- "We have rate limiting and abuse protection"
- "We track AI spend per day"
- "We get alerted when things break"

### Operational Maturity
- Clear escalation path (alert → dashboard → dead-letter → retry)
- Cost forecasting possible
- Capacity planning data available

---

## After A.5: What's Next?

**Phase B: Provider Call Execution Hardening**
- Retry strategies per provider
- Circuit breakers for failing providers
- Provider failover (OpenAI → Anthropic)
- Token usage optimization
- Streaming support

**Phase A.5 is NOT over-engineered.**  
It's the minimum viable hardening for production growth.

---

## Quick Start

```bash
# Day 1
npm run dev
# Implement adminGuard.ts
# Apply to all /api/admin/* routes
# Test auth enforcement

# Day 2  
# Add backpressure checks to /api/evaluate
# Create provider_usage_daily table
# Wire up cost tracking

# Day 3
# Create alert evaluation script
# Set up cron/worker to run every 5 min
# Test alert delivery

# Verify
bash scripts/verify-phase-a5.sh
```

---

**Focus:** Tight, tactical, high-ROI.  
**Avoid:** Over-engineering, premature optimization, feature creep.  
**Goal:** "Safe to grow" in 72 hours.
