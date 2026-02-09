# Phase C: Operational Hardening — Reliability & Observability

**Status**: 🚀 READY TO START  
**Goal**: "Every job completes or fails transparently, and system health can be assessed in <30s"  
**Estimated Duration**: 1–2 sprints  
**Date**: Starting 2026-02-08  

---

## Overview

Phase B (Governance) locked down contracts, types, and vocabulary. Phase C makes the system *reliable and observable*: every job path (success/retry/failure) is defined, logged, and queryable.

The result: when something breaks, you can answer these questions in under 30 seconds:
- How many jobs are stuck / failed / queued right now?
- What's the retry backoff distribution?
- Which job types have the highest failure rate?
- Is the system healthy or degrading?

---

## Definition of Done

✅ **Failure Envelope**: All possible job states (queued, running, complete, failed→canceled/retried) formalized with timestamps and metadata.

✅ **Structured Logs**: Every state transition emits a JSON log with job_id, status, phase, reason, retry_count, timestamp.

✅ **Observability v1**: SQL queries + basic dashboard showing:
   - Active jobs (running now)
   - Failed jobs (last 24h, grouped by type/reason)
   - Retry distribution (how many retries, success rate)
   - Job latency (p50, p95, p99)

✅ **Alerting Baseline**: Define thresholds for:
   - Jobs stuck in `running` for >5 min
   - Failure rate >5% for a job type
   - Deadletter queue depth >10

⏳ **Deadletter Formalization**: Deferred (post-D4). See future item once observability coverage is closed.

---

## Deliverables (In Order)

### D1: Failure Envelope Definition  
**Input**: Job lifecycle states from canon.ts, actual DB schema  
**Output**: `docs/FAILURE_ENVELOPE_v1.md`  

Defines the minimal set of fields every job must have at every state:
- `status` (canonical)
- `phase` (canonical)
- All timestamps: created_at, started_at, completed_at, failed_at, next_retry_at
- `failure_reason` (why it failed, if failed)
- `completed_units` / `total_units` (progress)
- `attempt_count` (retry counter)

Example:
```
Job in "failed" state MUST have:
- status: "failed"
- failed_at: timestamp
- failure_reason: string
- attempt_count: number ≥ 1
```

**Owner**: Agent (Agent: AI Job System Engineer)  
**Time**: 2–3 hours  
**Blocker**: None (uses existing schema)

---

### D2: Structured Logging Enhancement  
**Input**: Current job state transitions (phase1.ts, phase2.ts, cancel.ts, retry.ts)  
**Output**: Emit structured JSON logs on every state change  

Add to each state transition:
```typescript
logger.info('job:state_transition', {
  job_id: job.id,
  from_status: oldStatus,
  to_status: newStatus,
  phase: job.progress.phase,
  reason: reasonOrNull,
  attempt: job.progress.attempt_count,
  timestamp: new Date().toISOString(),
});
```

Use `console.log(JSON.stringify({...}))` if no structured logger exists; can upgrade later.

**Output Location**: `lib/jobs/logging.ts` (new file)  
**Owner**: Agent  
**Time**: 3–4 hours  
**Blocker**: Depends on D1 field agreement

---

### D3: Observability SQL Queries v1
**Input**: Job schema + structured logs  
**Output**: `docs/queries/OBSERVABILITY_QUERIES_v1.sql`  

Queries to answer key questions:
1. Current state distribution (how many jobs in each status right now?)
2. Failure reasons (top 10 failure reasons in last 24h)
3. Retry success rate (jobs that succeeded on retry vs those that failed)
4. Latency (p50/p95/p99 job duration by type)
5. Stuck detection (jobs in running for >N minutes)

Example:
```sql
-- Current system health
SELECT
  status,
  COUNT(*) as count,
  CASE status
    WHEN 'running' THEN 'ACTIVE'
    WHEN 'failed' THEN 'BLOCKED'
    WHEN 'complete' THEN 'SUCCESS'
    ELSE 'PENDING'
  END as health
FROM jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY CASE health WHEN 'BLOCKED' THEN 1 WHEN 'ACTIVE' THEN 2 ELSE 3 END;
```

**Output Location**: `docs/queries/OBSERVABILITY_QUERIES_v1.sql`  
**Owner**: Agent  
**Time**: 2–3 hours  
**Blocker**: D2 must define logging schema

---

### D4: Observability Coverage & Event Completeness
**Input**: LOGGING_SCHEMA_v1 + current emitter wiring  
**Output**: `docs/PHASE_C_D4_OBSERVABILITY_COVERAGE.md`

Prove that every critical lifecycle transition has either:
- An emitted observability event, or
- An explicit, documented deferral with rationale.

This closes the “silent transition” gap without requiring immediate wiring changes.

**Output Location**: `docs/PHASE_C_D4_OBSERVABILITY_COVERAGE.md`  
**Owner**: Agent  
**Time**: 1–2 hours  
**Blocker**: None (documentation + verification only)

---

### D5: Dashboard UI (Minimal)
**Input**: Observability queries from D3 + current metrics  
**Output**: Basic health page at `/dashboard/jobs-health`

Displays (read-only, no mutators):
- Current job counts by status (big numbers, green/yellow/red)
- Last 24h failure breakdown (pie chart by reason)
- Stuck job alerts (yellow if any running >5 min)
- Deadletter queue size + oldest item timestamp

Tech: Simple Next.js page + SWR polling, no external charting lib (use HTML tables + CSS).

**Output Location**: `app/dashboard/jobs-health/page.tsx`  
**Owner**: Agent  
**Time**: 2–3 hours  
**Blocker**: D3 queries must exist

---

## Acceptance Criteria by Deliverable

| D# | Deliverable | DONE Means | Validation |
|----|---------|-----------|-----------|
| D1 | Failure Envelope | Schema doc written, all states covered | Peer review: "Can I predict all required fields for any state?" |
| D2 | Structured Logs | Every transition logs JSON, parsing works | Sample logs from test run parse without error |
| D3 | Observability Queries | All 5 core queries written + tested | Run each query against test DB, verify results make sense |
| D4 | Observability Coverage | Coverage checklist complete; deferred items justified | Review coverage table + optional event inventory query |
| D5 | Dashboard UI | Page loads, auto-updates every 30s, reflects real data | Load page, verify counts match direct DB query |

---

## Success Metrics

After Phase C, you can answer:

1. ✅ How many jobs are in each state right now? (query D3-Q1, <1 second)
2. ✅ What's the failure rate for job type X? (query D3-Q2, <2 seconds)
3. ✅ Which jobs have been stuck? Why? (query D3-Q5, <1 second)
4. ⏳ Deadletter formalization is deferred (future item)
5. ✅ What's the system health at a glance? (dashboard page, real-time)

**All questions answerable in <30 seconds from dashboard or single query.**

---

## Roadmap to Production

- **Feb 8–15**: Phase C D1–D3 (schema + queries)
- **Feb 16–20**: Phase C D4–D5 (coverage checklist + dashboard)
- **Feb 21**: Operational hardening sign-off
- **Feb 22+**: UI confidence + billing integration
- **Mar 1**: Go-live (governance + reliability both green)

---

## Ownership & Handoff

**Phase C Sponsor**: Same agent as Phase B (governance authority intact)  
**Sign-Off**: Ops readiness (can you run the system unsupervised for 1 week?)  
**Future Owner**: Operational engineer (once stable)

---

## Notes

This phase is *not* about perfect observability; it's about *minimum viable observability*. Once operational hardening is locked, you can add dashboards, alerts, and metrics-collection tools. But the foundation (structured logging, queries, coverage checklist) is complete and non-negotiable.

---

## Related Documents

- [GOVERNANCE_AUTHORITY_INDEX.md](GOVERNANCE_AUTHORITY_INDEX.md) — What's governed
- [docs/CANONICAL_VOCABULARY.md](docs/CANONICAL_VOCABULARY.md) — Job terminology
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — Job schema
- [lib/jobs/phase1.ts](lib/jobs/phase1.ts) — State machine reference

