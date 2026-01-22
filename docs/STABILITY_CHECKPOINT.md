Stability Checkpoint: infra-hygiene-v1.0.0

Date: 2026-01-22
Commit: 0fc01af
Tag: infra-hygiene-v1.0.0
Status: ✅ Hygiene Locked, Ready for Phase 2

What's Locked at This Tag
Three Stable Layers

Job System — Phase 1 manuscript processing + chunking

Day-1 UI — Evaluation interface + admin controls

Production Safety — Guardrails + logging hygiene

Key Guarantees

✅ Memory store cannot be used in production (assertNotProductionMemoryStore)
✅ Logging is quiet by default; errors always visible
✅ Initial rate limiting defaults configured for 100k-user scale
✅ Atomic chunk claiming (no race conditions)
✅ Crash recovery enabled (15-min lease timeout)
✅ Schema migrations applied and verified
✅ Secrets properly segmented (anon vs service role; all server-side writes require SUPABASE_SERVICE_ROLE_KEY)
✅ Smoke runbook provides deployment quality gate
✅ UI polling uses adaptive backoff (2s → 30s) based on job age; enforced and unit-tested

What Was Committed
lib/jobs/guards.ts

Purpose: Production safety checks that fail-fast on misconfiguration

// Prevents memory store in production
export function assertNotProductionMemoryStore() {
  const isProduction = process.env.NODE_ENV === "production";
  const useSupabase = process.env.USE_SUPABASE_JOBS === "true";
  
  if (isProduction && !useSupabase) {
    throw new Error("Memory job store is not production-safe...");
  }
}

// Rate limiting for 100k-user scale
export const RATE_LIMITS = {
  JOB_CREATION_PER_HOUR: 10,      // per authenticated user
  MAX_CONCURRENT_JOBS: 5,          // per authenticated user
  IP_REQUESTS_PER_HOUR: 20,        // anonymous/fallback
  CLEANUP_INTERVAL_HOURS: 24,      // stale job cleanup
};


Impact: Silent failures become loud failures. The system screams if someone tries to use it wrong.

docs/SCALABILITY_PLAN.md

Purpose: Architecture and scaling strategy for 100k concurrent users

Covers:

Job system concurrency model (lease-based atomic claiming)

Rate limiting strategy (per-user + per-IP quotas)

Monitoring and observability expectations

Data model for 100k concurrent users

Retry + backoff strategy

Cost implications

Impact: Clear design contract for what this system can handle and how it behaves at scale.

Why This Matters
Silent Failures Are the Enemy at Scale

At 10 users: "Oh, the memory store crashed, I'll restart"
At 100k users: "The memory store silently dropped 50,000 jobs. How did we not notice for 6 hours?"

Solution: Make failures loud and immediate.

assertNotProductionMemoryStore() 
  → tries to start with memory store in prod
  → **BOOM, immediate error when running with NODE_ENV=production**
  → never reaches production

Quiet Code, Loud Errors

Logging default: Debug logging is opt-in via JOBS_DEBUG=1 (clean CI, clean logs)
Errors: Always visible, always visible, always visible

Result: Real errors don't get buried under noise.

Rate Limiting as a Guard
JOB_CREATION_PER_HOUR: 10  // Can't submit 100k jobs as 1 user
IP_REQUESTS_PER_HOUR: 20   // Can't DDoS from single IP
MAX_CONCURRENT_JOBS: 5     // Bounded concurrency per user


This prevents accidental resource exhaustion. At scale, this matters.

Rollback Safety

If anything breaks in Phase 2:

**git checkout -b rollback/infra-hygiene infra-hygiene-v1.0.0**
# You're back to this stable point on a safe branch

What's Next: Phase 2

Now that foundation is solid, safely add:

Week 1: LLM Provider Factory

Strict interface (what inputs/outputs does a model need?)

Deterministic fallbacks (Claude → GPT → offline mode)

Retry policy (exponential backoff, max N attempts)

Week 2: Phase 2 Finalize

Idempotent aggregation (all chunks done → finalize)

Schema validation before commit

Rerunnable design (same job ID = same result)

Week 3: Extended Smoke Runbook

Add Phase 2 LLM tests

Validate end-to-end latency

Keep same discipline level

Key discipline: Every layer gets the same treatment:

Fail-fast guards

Clear error messages

Rate limiting / resource bounds

Quality gate (smoke runbook)

Stability tag before moving forward

Files at This Tag
lib/jobs/
  ├── logging.ts                    ← quiet by default
  ├── guards.ts                     ← LOCKED (fail-fast)
  ├── jobStore.memory.ts            ← dev/test only
  ├── jobStore.supabase.ts          ← production
  └── ... (other job system files)

docs/
  ├── SCALABILITY_PLAN.md           ← LOCKED (architecture)
  └── ... (other docs)

Quick Checks at This Tag

Verify the guardrails are in place:

# Check guards are imported/used
grep -r "assertNotProductionMemoryStore" lib/

# Check rate limits are defined
grep -A 5 "RATE_LIMITS" lib/jobs/guards.ts

# Check logging is quiet by default
grep -A 3 "JOBS_DEBUG" lib/jobs/logging.ts

# Verify Supabase is required in prod
grep -r "USE_SUPABASE_JOBS" . --include="*.ts"

Commit Message (For Reference)
chore: lock production safety guardrails and scalability documentation

Non-behavioral hygiene: establishes guardrails that prevent silent 
production failures.

Changes:
- lib/jobs/guards.ts: Production safety checks (fail-fast on misconfig)
  * assertNotProductionMemoryStore() prevents memory store in prod
  * RATE_LIMITS and validation thresholds for 100k-user scale

- docs/SCALABILITY_PLAN.md: Architecture and scaling strategy
  * Job system concurrency model (lease-based claiming)
  * Rate limiting strategy (user + IP-based quotas)
  * Monitoring and observability expectations
  * Data model for 100k concurrent users

These guardrails ensure:
✓ No silent fallback to unsafe storage in production
✓ Clear CI output (quiet by default, errors always visible)
✓ Fail-fast on misconfiguration rather than runtime degradation
✓ Foundation for safe production-scale operation

This is hygiene, not behavior change. System operates identically to 
before; only now it will scream if someone tries to use it wrong.

One-Line Status

You're holding a stable platform. Foundation won't silently degrade. Safe to build Phase 2.

🚀