# Quality Gates v1

**Version**: 1.0  
**Status**: Active (Policy Only)  
**Canonical Source**: This document  
**Enforcement**: Manual (deferred to Phase 3)

---

## Purpose

Defines **observable quality thresholds** for the job evaluation system without enforcing them programmatically.

This document provides:
- Factual definitions of quality metrics
- Recommended thresholds for operational monitoring
- Guidance for when to investigate or intervene

**GOVERNANCE**: These are policy guidelines only. No automated blocking or job rejection is implemented in v1.

---

## Quality Metrics

### 1. Job Completion Rate

**Definition**: Percentage of jobs that reach `status=complete` vs. `status=failed`.

**Calculation**:
```
completion_rate = (complete_count / (complete_count + failed_count)) × 100
```

**Recommended Thresholds**:
- **Green**: ≥ 95% completion rate
- **Yellow**: 90–94% completion rate
- **Red**: < 90% completion rate

**Observability**: Query `/api/admin/metrics` for `job_counts.complete` and `job_counts.failed`.

**Interpretation**:
- Red threshold suggests systemic issues (AI provider outages, schema mismatches, infrastructure failures)
- Yellow threshold may indicate transient issues (rate limiting, retries exhausted)
- Green threshold is normal operational state

**Action**:
- Red: Investigate `last_error` field in failed jobs, check AI provider status, review logs
- Yellow: Monitor trends, check retry counts
- Green: No action required

---

### 2. Stale Running Jobs

**Definition**: Jobs with `status=running` AND `last_heartbeat` older than threshold.

**Calculation**:
```
stale_count = COUNT(jobs WHERE status=running AND last_heartbeat > 15 minutes ago)
```

**Recommended Thresholds**:
- **Green**: 0 stale jobs
- **Yellow**: 1–2 stale jobs
- **Red**: ≥ 3 stale jobs

**Observability**: Query `/api/admin/metrics` for `stale_running_jobs.count`.

**Interpretation**:
- Red threshold suggests worker failures, daemon crashes, or lease expiration bugs
- Yellow threshold may indicate slow evaluations or transient worker issues
- Green threshold is normal operational state

**Action**:
- Red: Check daemon status (`pm2 status rg-daemon`), review worker logs, verify database connectivity
- Yellow: Monitor job duration, check if jobs eventually complete
- Green: No action required

---

### 3. Job Duration

**Definition**: Time from `created_at` to terminal status (`complete` or `failed`).

**Calculation**:
```
duration_ms = terminal_timestamp - created_at
```

**Recommended Thresholds** (per job type):

| Job Type | Green | Yellow | Red |
|----------|-------|--------|-----|
| `evaluate_quick` | < 30s | 30s–60s | > 60s |
| `evaluate_full` | < 2min | 2min–5min | > 5min |
| `wave_pass` | < 1min | 1min–3min | > 3min |
| `synopsis_generate` | < 45s | 45s–90s | > 90s |

**Observability**: Calculate from observability events (`job_created` → `job_completed`) or query job timestamps.

**Interpretation**:
- Red threshold suggests AI provider latency, rate limiting, or inefficient evaluation logic
- Yellow threshold may indicate elevated load or network delays
- Green threshold is normal operational state

**Action**:
- Red: Check AI provider response times, review evaluation logic for unnecessary API calls
- Yellow: Monitor trends, verify no rate limiting is occurring
- Green: No action required

---

### 4. Retry Rate

**Definition**: Percentage of jobs that required at least one retry.

**Calculation**:
```
retry_rate = (jobs_with_retry_count > 0 / total_jobs) × 100
```

**Recommended Thresholds**:
- **Green**: < 5% retry rate
- **Yellow**: 5–15% retry rate
- **Red**: > 15% retry rate

**Observability**: Query `evaluation_jobs.retry_count` or count `retry_scheduled` events.

**Interpretation**:
- Red threshold suggests frequent transient failures (network, AI provider, timeouts)
- Yellow threshold may indicate occasional instability
- Green threshold is normal operational state

**Action**:
- Red: Review retry logic, check AI provider status, verify timeout configurations
- Yellow: Monitor error patterns, ensure retries are helping vs. masking systemic issues
- Green: No action required

---

### 5. Phase Transition Success Rate

**Definition**: Percentage of jobs that successfully transition from `phase_1` → `phase_2`.

**Calculation**:
```
phase_transition_rate = (jobs_reaching_phase_2 / jobs_completed_phase_1) × 100
```

**Recommended Thresholds**:
- **Green**: 100% transition rate (all Phase 1 completions advance)
- **Yellow**: 95–99% transition rate
- **Red**: < 95% transition rate

**Observability**: Query jobs with `phase=phase_1 AND status=complete` vs. jobs with `phase=phase_2`.

**Interpretation**:
- Red threshold suggests phase gating bugs or illegal state transitions
- Yellow threshold may indicate edge cases in evaluation logic
- Green threshold is expected per JOB_CONTRACT_v1 (Phase 1 complete → Phase 2 queued)

**Action**:
- Red: Review `canRunPhase()` logic in `lib/jobs/store.ts`, check for race conditions
- Yellow: Investigate jobs stuck at Phase 1 complete
- Green: No action required

---

## Enforcement Strategy (v1)

**Current State**: Policy documentation only (manual monitoring).

**Future Enhancements** (Phase 3):
- Automated alerting when thresholds are breached
- Dashboard visualizations for quality metrics
- Automated job rejection if quality gates fail (e.g., block job creation if completion rate < 90%)

**GOVERNANCE**: Quality gates must never:
- Block legitimate user requests
- Mask underlying system failures
- Fabricate job statuses or progress
- Override canonical job state transitions per JOB_CONTRACT_v1

---

## Related Documents

- [JOB_CONTRACT_v1.md](./JOB_CONTRACT_v1.md) - Canonical job status definitions and state transitions
- [METRICS_API_v1.md](./METRICS_API_v1.md) - Read-only metrics endpoint for observability

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-26 | Initial release: policy-only quality thresholds (no enforcement) |
