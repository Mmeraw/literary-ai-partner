# Phase C Evidence Pack — Audit-Grade Reliability & Observability

**Status**: 🚧 IN PROGRESS  
**Goal**: "Every job completes or fails transparently, and system health can be assessed in <30 seconds"  
**Date Started**: 2026-02-08  

---

## Phase C Scope

### Prerequisites (✅ Complete)
- ✅ Governance Rules #1–#4 CLOSED and enforced
- ✅ Canonical vocabulary locked ([GOVERNANCE_CLOSEOUT_CANONICAL_VOCABULARY.md](GOVERNANCE_CLOSEOUT_CANONICAL_VOCABULARY.md))
- ✅ Stable job contract ([docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md))

### Definition of Done
Phase C is complete when:
1. All five deliverables marked ✅ with proof
2. Ops can answer health questions in <30s (validated via [OPS_READINESS_SIGNOFF.md](OPS_READINESS_SIGNOFF.md))
3. System can run unattended for 7 days

---

## Evidence Table

| Deliverable | Evidence Artifact | Proof Type | Status | Proof Link |
|-------------|------------------|------------|--------|------------|
| **D1** Failure Envelope | `docs/FAILURE_ENVELOPE_v1.md` | Spec + peer review | ⏳ PENDING | [Proof D1](#d1-failure-envelope-proof) |
| **D2** Structured Logs | `lib/jobs/logging.ts` | Runtime logs | ⏳ PENDING | [Proof D2](#d2-structured-logs-proof) |
| **D3** Observability Queries | `docs/queries/OBSERVABILITY_QUERIES_v1.sql` | Query results | ⏳ PENDING | [Proof D3](#d3-observability-queries-proof) |
| **D4** Deadletter Path | `lib/jobs/deadletter.ts` + migration | DB row existence | ⏳ PENDING | [Proof D4](#d4-deadletter-path-proof) |
| **D5** Health Dashboard | `/dashboard/jobs-health` | Live UI | ⏳ PENDING | [Proof D5](#d5-health-dashboard-proof) |

---

## Deliverable Proofs

### D1: Failure Envelope Proof

**Artifact**: `docs/FAILURE_ENVELOPE_v1.md`

**Proof Command**:
```bash
cat docs/FAILURE_ENVELOPE_v1.md
```

**Proof Criteria** (all must be true):
- [ ] All job states covered (queued, running, complete, failed)
- [ ] All timestamps defined (created_at, started_at, completed_at, failed_at, next_retry_at)
- [ ] Retry path explicit (attempt_count, failure_reason)
- [ ] Deadletter path explicit (exhaustion threshold, routing)
- [ ] Cancellation semantics documented (failed + canceled_at)

**Validation Method**: Peer review  
**Reviewer Checkpoint**: "Can I predict all required fields for any job state?"

**Evidence Capture** (populate when complete):
```
Date Completed: _______
Reviewer: _______
Result: PASS / FAIL
Notes: _______
```

---

### D2: Structured Logs Proof

**Artifact**: `lib/jobs/logging.ts`

**Proof Command** (static check):
```bash
grep -R "job:state_transition" lib/jobs | wc -l
```

**Expected Output**: `>= 10` (all state transitions instrumented)

**Runtime Proof**:
```bash
pnpm dev
# Trigger a job via UI or API
# Check logs for JSON structure
tail -f /tmp/dev-server.log | grep "job:state_transition"
```

**Sample Valid Log**:
```json
{
  "event": "job:state_transition",
  "job_id": "abc-123",
  "from_status": "running",
  "to_status": "failed",
  "phase": "phase_2",
  "attempt": 2,
  "reason": "timeout",
  "timestamp": "2026-02-08T10:22:14Z"
}
```

**Proof Criteria**:
- [ ] Every state transition emits JSON log
- [ ] All required fields present (job_id, from_status, to_status, phase, attempt, timestamp)
- [ ] Logs are parseable without error: `jq . < log_sample.json`

**Evidence Capture** (populate when complete):
```
Date Completed: _______
Sample Log File: _______
Parse Test: jq . < _______ (PASS/FAIL)
```

---

### D3: Observability Queries Proof

**Artifact**: `docs/queries/OBSERVABILITY_QUERIES_v1.sql`

**Proof Commands**:

1. **Current System Health** (Q1):
```sql
SELECT status, COUNT(*) as count 
FROM jobs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

2. **Stuck Jobs Detection** (Q5):
```sql
SELECT id, job_type, started_at, 
       EXTRACT(EPOCH FROM (NOW() - started_at))/60 as minutes_stuck
FROM jobs
WHERE status = 'running'
AND started_at < NOW() - INTERVAL '5 minutes'
ORDER BY started_at ASC;
```

3. **Failure Reasons** (Q2):
```sql
SELECT 
  progress->>'failure_reason' as reason,
  COUNT(*) as count
FROM jobs
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY reason
ORDER BY count DESC
LIMIT 10;
```

4. **Retry Success Rate** (Q3):
```sql
SELECT 
  job_type,
  COUNT(*) FILTER (WHERE status = 'complete' AND (progress->>'attempt_count')::int > 1) as retry_success,
  COUNT(*) FILTER (WHERE status = 'failed' AND (progress->>'attempt_count')::int > 1) as retry_failed
FROM jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type;
```

5. **Latency Percentiles** (Q4):
```sql
SELECT 
  job_type,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p50_seconds,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p95_seconds,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - created_at))) as p99_seconds
FROM jobs
WHERE status = 'complete'
AND completed_at > NOW() - INTERVAL '24 hours'
GROUP BY job_type;
```

**Proof Criteria**:
- [ ] All 5 queries execute without error
- [ ] Each query completes in <2 seconds
- [ ] Results are sane (no NULL counts, reasonable durations)

**Evidence Capture** (populate when complete):
```
Date Completed: _______
Test Database: _______ (staging/local)
Q1 Execution Time: _______ ms
Q2 Execution Time: _______ ms
Q3 Execution Time: _______ ms
Q4 Execution Time: _______ ms
Q5 Execution Time: _______ ms
Sample Results: [attach screenshot or output]
```

---

### D4: Deadletter Path Proof

**Artifact**: `lib/jobs/deadletter.ts` + migration `supabase/migrations/NNNNNN_deadletter_jobs.sql`

**Static Proof**:
```bash
# Verify deadletter module exists
cat lib/jobs/deadletter.ts | grep "export.*moveToDeadletter"

# Verify migration exists
ls -la supabase/migrations/*deadletter*.sql
```

**DB Schema Proof**:
```sql
\d deadletter_jobs
```

**Expected Schema**:
```
Table: deadletter_jobs
Columns:
  id (uuid, PK)
  job_id (uuid, FK → jobs.id)
  job_type (text)
  failure_history (jsonb)
  operator_hint (text)
  created_at (timestamptz)
Indexes:
  PK on id
  Index on created_at
  Index on job_id
```

**Runtime Proof**:
```bash
# 1. Create test job
# 2. Force retry exhaustion (set attempt_count > MAX_RETRIES)
# 3. Verify deadletter entry created

# Query:
SELECT * FROM deadletter_jobs ORDER BY created_at DESC LIMIT 1;
```

**Proof Criteria**:
- [ ] Migration applies cleanly
- [ ] `deadletter_jobs` table exists with correct schema
- [ ] Test job routes to deadletter after exhaustion
- [ ] Deadletter row contains: job_id, failure_history, operator_hint

**Evidence Capture** (populate when complete):
```
Date Completed: _______
Migration Applied: supabase/migrations/_______.sql
Test Job ID: _______
Deadletter Row Created: YES / NO
Operator Hint Present: YES / NO
```

---

### D5: Health Dashboard Proof

**Artifact**: `app/dashboard/jobs-health/page.tsx`

**Proof Command**:
```bash
open http://localhost:3000/dashboard/jobs-health
```

**Visual Proof** (screenshot checklist):
- [ ] Current job counts by status (big numbers, color-coded)
- [ ] Last 24h failure breakdown (table or chart by reason)
- [ ] Stuck job alerts (yellow/red if any running >5 min)
- [ ] Deadletter queue size + oldest item timestamp
- [ ] Auto-refresh indicator (<= 30s interval)

**Validation Proof** (query-to-UI consistency):
```bash
# 1. Run Q1 query (current status counts)
# 2. Compare to dashboard "Current Jobs" widget
# 3. Verify numbers match exactly
```

**Proof Criteria**:
- [ ] Dashboard loads without error
- [ ] Counts match direct SQL queries (within 30s refresh window)
- [ ] No mutator buttons (read-only UI)
- [ ] Auto-refresh works (verify timestamp updates)

**Evidence Capture** (populate when complete):
```
Date Completed: _______
Dashboard URL: http://localhost:3000/dashboard/jobs-health
Screenshot: [attach]
Query Consistency Test: PASS / FAIL
Auto-Refresh Verified: YES / NO
```

---

## Phase C Acceptance

### Minimum Viable Observability (MVO) Checklist

All must be ✅ for Phase C sign-off:

- [ ] **D1**: Failure envelope doc written, peer-reviewed, all states covered
- [ ] **D2**: Structured logs emit on every state transition, parseable JSON
- [ ] **D3**: All 5 observability queries execute in <2s with sane results
- [ ] **D4**: Deadletter table exists, test job routes correctly on exhaustion
- [ ] **D5**: Health dashboard loads, matches queries, auto-refreshes ≤30s

### <30s Health Check Proof

**Validation Command**:
```bash
# From zero context, answer these questions in <30 seconds total:

time bash -c '
echo "Q1: How many jobs running now?"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM jobs WHERE status = '\''running'\'';"

echo "Q2: Any stuck jobs?"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM jobs WHERE status = '\''running'\'' AND started_at < NOW() - INTERVAL '\''5 minutes'\'';"

echo "Q3: Jobs in deadletter?"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM deadletter_jobs;"

echo "Q4: Top failure reason?"
psql $DATABASE_URL -c "SELECT progress->>'\''failure_reason'\'' as reason, COUNT(*) FROM jobs WHERE status = '\''failed'\'' AND created_at > NOW() - INTERVAL '\''24 hours'\'' GROUP BY reason ORDER BY COUNT(*) DESC LIMIT 1;"
'
```

**Expected**: Total execution time <30 seconds.

### 7-Day Unattended Operation Proof

**Test Protocol**:
1. Date started: _______
2. Date ended: _______
3. Manual interventions required: _______ (target: 0)
4. Jobs processed: _______
5. Failures handled gracefully: YES / NO
6. Deadletter accumulation: _______ (acceptable: <10)

---

## Sign-Off

Phase C is complete when:

1. ✅ All five deliverables have completed proofs above
2. ✅ [OPS_READINESS_SIGNOFF.md](OPS_READINESS_SIGNOFF.md) all boxes checked
3. ✅ <30s health check validated
4. ✅ 7-day unattended test passed

**Signed Off By**: _______  
**Date**: _______  
**Next Phase**: Production Readiness (UI confidence + billing)

---

## Related Documents

- [GOVERNANCE_AUTHORITY_INDEX.md](GOVERNANCE_AUTHORITY_INDEX.md) — What's governed
- [PHASE_C_RELIABILITY_ROADMAP.md](PHASE_C_RELIABILITY_ROADMAP.md) — Phase C charter
- [OPS_READINESS_SIGNOFF.md](OPS_READINESS_SIGNOFF.md) — Operational questions checklist
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — Job schema reference

---

**Authority**: This evidence pack is the single proof mechanism for Phase C completion. When in doubt about "is Phase C done?", consult the checklist above.
