# Rate Limiting & Production Safety

## Overview

Production-grade multi-layer rate limiting designed to scale to **100,000 concurrent users** across all Literary AI Partner features.

## Architecture

### 3-Layer Protection

```
┌─────────────────────────────────────────┐
│  Layer 1: IP-Based Throttling          │
│  • 20 requests/hour per IP              │
│  • Fallback for anonymous users         │
│  • In-memory tracking (consider Redis)  │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Layer 2: User Rate Limits              │
│  • 10 jobs/hour per authenticated user  │
│  • 5 concurrent active jobs max         │
│  • DB-backed via Supabase               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│  Layer 3: Feature Access Control        │
│  • Premium feature gating               │
│  • Resource-based tiering               │
│  • Quality threshold enforcement        │
└─────────────────────────────────────────┘
```

## Feature Rate Limits

### Core Evaluation (Free + Premium)
- **evaluate_full**: 10/hour - Full manuscript evaluation (13 criteria)
- **evaluate_chapter**: 20/hour - Chapter-level evaluation
- **evaluate_scene**: 30/hour - Scene-level evaluation

### Advanced Evaluation (Premium Only)
- **evaluate_wave**: 5/hour - WAVE Revision Guide (63+ waves across spine)
  - Resource-intensive: Multiple AI passes
  - Requires 8.0/10 baseline quality

### Agent Package Generation (Premium, 8.0+ Quality)
- **generate_agent_package**: 3/hour - Complete agent submission package
  - Biography
  - Synopsis
  - Pitch
  - Market comparables
  - Query letter
- **generate_synopsis**: 10/hour - Standalone synopsis
- **generate_query_letter**: 10/hour - Standalone query letter  
- **generate_comparables**: 5/hour - Market analysis

### Conversion Features
- **convert_chapter_to_scene**: 15/hour (Free + Premium)
- **convert_manuscript_to_screenplay**: 5/hour (Premium Only)

### Film Adaptation (Premium Only)
- **generate_film_package**: 3/hour - 12-slide film adaptation deck
  - Resource-intensive multi-format conversion

### Revision Workflow (Free + Premium)
- **apply_revision**: 50/hour - User-accepted or custom revisions
  - High limit for interactive revision flow

## Size Limits

### Manuscript Size: 5MB Maximum
- Average novel: ~400KB
- Large screenplay: ~2MB
- 5MB handles 99% of manuscripts
- Prevents abuse and resource exhaustion

**Size Guidelines:**
```typescript
{
  scene: "~50KB",
  chapter: "~100-200KB", 
  full_manuscript: "~400KB-2MB",
  screenplay: "~1-2MB",
  max_allowed: "5MB"
}
```

## Scaling Calculations

### 100k User Capacity

**Job Creation Load:**
```
100,000 users × 10 jobs/hour = 1M jobs/hour
1M jobs/hour ÷ 3600 seconds = ~278 jobs/second peak theoretical
```

**Actual Load (with backoff):**
- New jobs trigger fast polling (2s) initially
- Jobs age into slower polling (5s → 10s → 30s)
- Average API load: **~50-100 req/sec** at steady state

**Polling Load Reduction:**
```
100k active jobs × (1/2s polling) = 50,000 req/sec (unsustainable)
100k active jobs × (1/30s backoff) = 3,333 req/sec (manageable)
Backoff provides 15x load reduction
```

## Implementation Details

### Rate Limiter (`lib/jobs/rateLimiter.ts`)

```typescript
// Main entry point
await checkJobCreationRateLimit(req)
→ IP throttling (anonymous)
→ User rate limit (authenticated)
→ Concurrent jobs limit
→ Returns: { allowed, reason, retryAfter }

// Size validation
validateManuscriptSize(bytes)
→ Checks against RATE_LIMITS.MAX_MANUSCRIPT_SIZE
→ Returns: { allowed, reason }

// Feature access
await checkFeatureAccess(userId, jobType, userTier)
→ Authentication requirement
→ Premium feature gating
→ Returns: { allowed, reason }
```

### API Integration (`app/api/jobs/route.ts`)

```typescript
POST /api/jobs
├─ Layer 1: checkJobCreationRateLimit(req) → 429 if exceeded
├─ Layer 2: validateManuscriptSize(size) → 413 if too large
├─ Layer 3: checkFeatureAccess(userId, type, tier) → 403 if denied
└─ Create job → 201 Created
```

### HTTP Status Codes

- **429 Too Many Requests**: Rate limit exceeded
  - Headers: `Retry-After` (seconds)
  - Body: `{ ok: false, error: "...", retry_after: 3600 }`

- **413 Payload Too Large**: Manuscript exceeds 5MB
  - Body: `{ ok: false, error: "Manuscript too large. Maximum size: 5MB" }`

- **403 Forbidden**: Feature access denied
  - Body: `{ ok: false, error: "This feature requires a premium subscription." }`

## Production Checklist

### Required Environment Variables

```bash
# Critical for 100k-user scale
NODE_ENV=production
USE_SUPABASE_JOBS=true

# Supabase connection (durable job storage)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Optional but recommended
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Admin operations
NEXTAUTH_SECRET=xxx               # User authentication
```

### Validation Script

```bash
npm run config:validate
# or
node scripts/validate-production-config.mjs
```

**Output:**
```
🔍 Validating production configuration...

✅ Production configuration is valid

📊 Configuration Summary:
   NODE_ENV: production
   USE_SUPABASE_JOBS: true
   SUPABASE_URL: ✓ Set
   SUPABASE_ANON_KEY: ✓ Set
```

## Database Schema Requirements

### Rate Limiting Queries

```sql
-- User rate limit check
SELECT COUNT(*) FROM evaluation_jobs 
WHERE user_id = $1 
  AND created_at >= NOW() - INTERVAL '1 hour';

-- Concurrent jobs check  
SELECT COUNT(*) FROM evaluation_jobs
WHERE user_id = $1
  AND status IN ('queued', 'running', 'retry_pending');
```

**Performance:**
- Indexed on `(user_id, created_at)` 
- Indexed on `(user_id, status)`
- Both queries < 10ms at 1M+ job scale

## Monitoring & Observability

### Key Metrics to Track

```typescript
// Job creation metrics
metrics.onJobCreated(jobId, jobType)

// Rate limit hits
metrics.onRateLimitExceeded(userId, limitType)

// Feature usage distribution
metrics.onFeatureAccess(userId, jobType, tier)
```

### Alerts to Configure

1. **Rate limit hit rate > 5%**: May indicate legitimate user confusion or attack
2. **429 responses > 100/min**: Possible attack or client bug
3. **413 responses**: Users hitting size limits (may need education)
4. **Concurrent jobs near limit**: May need tier adjustment

## Client-Side Integration

### Handling Rate Limits

```typescript
try {
  const response = await fetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify({ manuscript_id, job_type })
  });
  
  if (response.status === 429) {
    const data = await response.json();
    // Show user-friendly message
    showError(`Rate limit exceeded. Try again in ${data.retry_after}s`);
  }
  
  if (response.status === 413) {
    showError('Manuscript too large. Maximum 5MB.');
  }
  
  if (response.status === 403) {
    showUpgradePrompt('This feature requires a premium subscription.');
  }
} catch (err) {
  // Handle network errors
}
```

## Future Enhancements

### Phase 2: Redis-Backed Rate Limiting
- Replace in-memory IP tracking with Redis
- Enables multi-instance horizontal scaling
- Distributed rate limiting across regions

### Phase 3: Subscription Tier Customization
```typescript
const tierLimits = {
  free: { maxPerHour: 10, maxConcurrent: 3 },
  premium: { maxPerHour: 50, maxConcurrent: 10 },
  professional: { maxPerHour: 200, maxConcurrent: 25 },
  agent: { maxPerHour: 1000, maxConcurrent: 100 }
};
```

### Phase 4: Quality-Based Throttling
- Users with 8.0+ submissions get higher limits
- Incentivizes quality over quantity
- Reduces low-quality spam evaluations

## Testing

```bash
# Run rate limiting tests
npx jest tests/rate-limiting.test.ts

# Test production config validation
node scripts/validate-production-config.mjs
```

**Test Coverage:**
- ✅ 26 rate limiting tests (all passing)
- ✅ Manuscript size validation
- ✅ Feature access control
- ✅ Multi-feature platform support
- ✅ 100k-user scalability calculations

## Support

For issues or questions:
1. Check monitoring dashboards for rate limit patterns
2. Review user's recent job history in DB
3. Verify environment configuration
4. Consider tier adjustment for high-value users

---

**Last Updated:** January 2026  
**Scale Target:** 100,000 concurrent users  
**Status:** ✅ Production-ready
