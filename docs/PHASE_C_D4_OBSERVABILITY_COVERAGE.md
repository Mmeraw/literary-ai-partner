# Phase C D4 — Observability Coverage & Event Completeness

**Status**: ✅ READY TO CLOSE (Checklist Complete, Evidence-Based)  
**Owner**: RevisionGrade Governance  
**Last Updated**: 2026-02-08  
**Coverage Rate**: 7% implemented (1/14 events), 93% deferred with rationale  

---

## Purpose

D4 proves **observability coverage**: that every critical job lifecycle transition has an explicit observability event emitted or an explicit, documented deferral.

This is a **coverage assurance** task, not a wiring mandate.

---

## Scope

**In scope**:
- Coverage of job lifecycle transitions (created, claimed, started, completed, failed, retry scheduled)
- Admin/operator events (retry requested/executed, status change)
- Explicit documentation of deferred events (with rationale)

**Out of scope**:
- Enforcing correctness of payload values (covered by D2 contract + D1 envelope)
- Thresholding/alerts (future)

---

## Canonical Event Types (v1)

Refer to [LOGGING_SCHEMA_v1](LOGGING_SCHEMA_v1.md) for the canonical event list.

---

## Coverage Checklist (D2 observability_events System)

**Distinction**: This checklist tracks emissions to the `observability_events` table (D2 contract). 
A separate passive metrics system exists (`lib/jobs/metrics.ts`) but is out of scope for D4.

### Job Lifecycle Events

| Lifecycle Transition | Expected Event Type | Status | Emitter Location | Rationale |
|---|---|---|---|---|
| **Job created** | `job.created` | ⚠️ DEFERRED | — | Minimal D2 wiring scope; creation tracking exists in passive metrics.ts but not in observability_events table. Will add when lifecycle coverage expands. |
| **Job claimed** | `job.claimed` | ⚠️ DEFERRED | — | Job leasing tracked in job state; explicit observability event deferred until post-D4 wiring. |
| **Job started** | `job.started` | ⚠️ DEFERRED | — | Status transition tracked in evaluation_jobs.status; explicit event emission deferred. |
| **Job progress updated** | `job.progress_updated` | ⚠️ DEFERRED | — | Progress tracked in evaluation_jobs.progress; explicit observability event optional (high volume). |
| **Job completed (success)** | `job.completed` | ⚠️ DEFERRED (Intentional) | — | User instruction: "leave it ⏳ until you explicitly decide to wire it." Success-path observability deferred to enable Q2 failure-rate analytics. |
| **Job failed (terminal)** | `job.failed` | ✅ IMPLEMENTED | `lib/jobs/jobStore.supabase.ts::setJobFailed()` | Emitted on terminal failure with D1 failure envelope (failed_at, failure_reason, attempt_count). Idempotency key: `attempt:${N}`. |
| **Retry scheduled** | `job.retry_scheduled` | ⚠️ DEFERRED | — | Retry scheduling logic exists; explicit observability event deferred until retry metrics formalized. |
| **Deadlettered** | `job.dead_lettered` | ⚠️ DEFERRED | — | Deadletter storage and workflow explicitly deferred to post-D4; documented in Phase C roadmap. |

### Admin / Operator Events

| Admin Action | Expected Event Type | Status | Emitter Location | Rationale |
|---|---|---|---|---|
| **Admin retry requested** | `admin.retry_requested` | ⚠️ DEFERRED | — | Admin API wiring not part of D2 minimal slice; deferred to admin UX phase. |
| **Admin retry executed** | `admin.retry_executed` | ⚠️ DEFERRED | — | Same as above; admin action tracking deferred. |
| **Admin status change** | `admin.job_status_changed` | ⚠️ DEFERRED | — | Admin manual status overrides deferred; governance policy not yet formalized. |

### System / Heartbeat Events

| System Event | Expected Event Type | Status | Emitter Location | Rationale |
|---|---|---|---|---|
| **Job heartbeat** | `job.heartbeat` | ⚠️ DEFERRED | — | Liveness monitoring out of Phase C scope; lease expiry provides crash detection. |
| **Lease expired** | `job.lease_expired` | ⚠️ DEFERRED | — | Lease expiry tracked via timestamps; explicit event emission deferred (high volume). |
| **Contract violation** | `job.contract_violation_detected` | ⚠️ DEFERRED | — | Contract violations logged to errorLog; observability event optional (low frequency). |

---

## Coverage Summary

| Category | Implemented | Deferred | Total |
|----------|-------------|----------|-------|
| **Job Lifecycle** | 1 | 7 | 8 |
| **Admin Events** | 0 | 3 | 3 |
| **System Events** | 0 | 3 | 3 |
| **TOTAL** | **1** | **13** | **14** |

**Coverage Rate**: 7% (1/14 events implemented)  
**Audit Status**: ✅ ACCEPTABLE — All deferred items have explicit rationale; no silent transitions.

---

## Explicit Deferrals (Non-Blocking)

The following items are intentionally deferred and **do not block Phase C closure**:

### 1. Success-Path Events (`job.completed`)

**Rationale**: Completion semantics not yet canonicalized; D3 Q2 (failure rate by job_type) explicitly marked informational until success emissions wired.

**Impact**: None on failure observability or reliability guarantees. Terminal failures remain fully observable via `job.failed`.

**When to wire**: When failure-rate analytics become operational requirement (post-D4).

### 2. Lifecycle Transition Events (`job.created`, `job.started`, `job.claimed`)

**Rationale**: D2 shipped as minimal slice (contract + store + one proof hook). Broader lifecycle wiring deferred to avoid blocking Phase C progress.

**Impact**: No impact on failure diagnosis or audit trail. Job creation/start tracked in `evaluation_jobs` table; observability events are **supplemental**, not primary.

**When to wire**: Incrementally, as observability coverage expands post-D4.

### 3. Admin Action Events (`admin.retry_requested`, etc.)

**Rationale**: Admin API and UX deferred; no admin event emissions until admin workflows formalized.

**Impact**: Manual admin actions logged via application logs; observability events for admin actions are enhancement, not requirement.

**When to wire**: During admin UX implementation.

### 4. Deadletter Events (`job.dead_lettered`)

**Rationale**: Deadletter storage and formal workflows explicitly deferred to post-D4 (documented in Phase C roadmap and FAILURE_ENVELOPE_v1.md).

**Impact**: Failed jobs remain queryable and auditable via D1 failure envelope; deadletter is operator convenience, not correctness requirement.

**When to wire**: Post-D4, as part of deadletter formalization.

### 5. High-Volume Events (`job.heartbeat`, `job.lease_expired`, `job.progress_updated`)

**Rationale**: High cardinality; cost/benefit analysis required before enabling.

**Impact**: None. Lease expiry detectable via timestamp comparison; heartbeat is liveness monitoring (out of Phase C scope).

**When to wire**: If/when liveness monitoring becomes operational requirement.

---

**Deferral Conclusion**: All deferrals are documented, intentional, and reversible. No silent failure paths exist.

---

## Evidence & Verification

### Static Verification
- ✅ Coverage table completed (14 lifecycle transitions documented)
- ✅ Deferred items have explicit rationale (see above)
- ✅ No silent transitions remain undocumented

### Runtime Evidence
```sql
-- Verify current event type coverage
SELECT event_type, COUNT(*) AS event_count
FROM public.observability_events
GROUP BY event_type
ORDER BY event_count DESC;

-- Expected result (as of D4 closure):
-- event_type     | event_count
-- ---------------+-------------
-- job.failed     | N (where N >= 0)
```

**Interpretation**: 
- If `job.failed` appears: ✅ D2 minimal wiring operational
- If no rows: ⚠️ No terminal failures triggered yet (acceptable; table exists and contract enforced)
- If other event types appear: ⚠️ Lifecycle wiring expanded beyond D2 minimal scope (verify intentional)

---

## D4 Completion Criteria

D4 is ✅ CLOSED when:
- ✅ Coverage checklist is complete and reviewed (14 transitions documented)
- ✅ Deferred items are explicitly documented with rationale (13 deferrals justified)
- ✅ No lifecycle transitions remain silent/undocumented (all transitions accounted for)
- ✅ Implementation status matches actual codebase (audit-verified: only `job.failed` emits)

**Audit Validation**:
- Codebase grep for `emitObservabilityEvent(` confirms only 1 call site: `setJobFailed()`
- D2 governance closeout explicitly documents minimal wiring model
- Phase C evidence pack reflects accurate implementation status

**Result**: ✅ D4 completion criteria met; ready for closure

---

## Notes

This D4 item is intentionally **non-blocking** for Phase C progress. It provides audit-grade clarity on observability coverage without forcing immediate wiring changes.

**Key Distinction**: This checklist tracks the D2 `observability_events` table system (audit-grade, append-only, contract-enforced). A separate passive metrics system exists in `lib/jobs/metrics.ts` that emits to console/datadog backends but is out of scope for D4.

**Closure Readiness**: D4 is ready to close with **7% implementation, 93% explicit deferrals**. This is audit-acceptable because:
1. All deferrals are documented with rationale
2. No silent failure paths exist (job.failed is implemented)
3. Deferred items have clear "when to wire" guidance
4. Implementation status matches actual codebase (verified via grep/semantic search)
