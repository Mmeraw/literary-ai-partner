# Phase C D1: Integration & Evidence (PARTIAL)

**Status**: ⏳ PARTIAL  
**Scope**: Runtime integration + proof query execution  
**Date**: 2026-02-08  
**Next Step**: Run proof query against Supabase (see [D1 Proof Guide](PHASE_C_D1_PROOF_GUIDE.md))

---

## Key Insight

D1 is **NOT** a spec-writing task; it is a **runtime integration + evidence** task.

- Phase A.1 and Phase 2C already provided the envelope design (structured error codes + canonical result envelopes).
- Phase C D1 proves that all job failure surfaces emit the envelope consistently.

---

## Deliverables

### 1. Contract Document: `docs/FAILURE_ENVELOPE_v1.md`

**What it is**: Single-source-of-truth for job failure envelope semantics

**What it covers**:
- Canonical status fields (status, phase, phase_status, created_at)
- State-specific requirements (queued, running, complete, failed)
- Error classification integration (Phase A.1 error codes)
- Runtime metadata integration (Phase 2C envelope fields)
- Semantic sub-cases for failed jobs (Canceled, Retryable, Deadletter)
- Enforcement point: `lib/jobs/jobStore.supabase.ts` → `mapDbRowToJob()`

**Cross-links**:
- Phase A.1 error taxonomy: [docs/PHASE_A1_COMPLETE.md](docs/PHASE_A1_COMPLETE.md)
- Phase 2C runtime metadata: [docs/PHASE2C_EVIDENCE_COMMAND.md](docs/PHASE2C_EVIDENCE_COMMAND.md)

---

### 2. Observability Queries: `docs/queries/OBSERVABILITY_QUERIES_v1.sql`

**What it is**: Six production-ready SQL queries for Phase C operations

**Queries**:
- **Q0** — D1 Integrity Proof: Find failed jobs missing required envelope fields
- **Q1** — System Health: Current job distribution by status
- **Q2** — Failure Reasons: Top error codes in last 24h
- **Q3** — Retry Success: Jobs that benefited from retry
- **Q4** — Latency: p50/p95/p99 execution times
- **Q5** — Stuck Detection: Jobs running >5 minutes
- **Q6** — Deadletter Preview: Jobs approaching MAX_RETRIES (prep for deferred deadletter item)

**Usage**:
```bash
# Execute all observability queries
psql $SUPABASE_DB_URL_CI -f docs/queries/OBSERVABILITY_QUERIES_v1.sql
```

---

### 3. Updated Evidence Pack: `PHASE_C_EVIDENCE_PACK.md`

**Changes**:
- D1 status: ⏳ PENDING → 🔄 IN PROGRESS
- D1 scope clarified: "Contract + Runtime Integration & Evidence"
- D1 proof criteria expanded: Spec review + SQL data integrity check
- D3 status: ⏳ PENDING → 🔄 IN PROGRESS (queries now written)
- D3 proof expanded: Now includes Q0–Q6 with execution checklist

---

## How This Connects D1 → D2–D5

| Phase | Artifact | Interface to D1 |
|-------|----------|-----------------|
| **Phase A.1** | Error codes | D1 requires these in `failure_reason` field |
| **Phase 2C** | Runtime metadata | D1 requires `provider_meta`, `openai_runtime` on failure |
| **Phase C D1** | Failure envelope | ← You are here (contract + proof) |
| **Phase C D2** | Structured logging | D2 emits D1 envelope on every state transition → structured logs |
| **Phase C D3** | Observability queries | D3 queries (Q0–Q6) assume D1 envelope is populated |
| **Phase C D4** | Observability coverage | D4 documents event completeness (implemented vs deferred) |
| **Deferred** | Deadletter path | Post-D4 item using D1 fields (attempt_count > MAX_RETRIES) |
| **Phase C D5** | Health dashboard | D5 tiles visualize D1 fields (error counts, retry rates, etc.) |

---

## Next Steps

### To Move D1 from IN PROGRESS → DONE:

1. **Spec Review** (1–2h)
   - Peer review `docs/FAILURE_ENVELOPE_v1.md`
   - Confirm all state requirements are clear
   - Validate cross-links to Phase A.1 and 2C

2. **Data Integrity Proof** (30 min)
   - Run Q0 query against Supabase (target: 0 rows)
   - Confirms all failed jobs have `failed_at`, `failure_reason`, `attempt_count`

3. **Code Walkthrough** (1h)
   - Identify and review `mapDbRowToJob()` implementation
   - Confirm it enforces D1 contract for all job reads
   - Add/verify unit tests for envelope validation

4. **Evidence Package**
   - Populate evidence capture section in Evidence Pack
   - Add spec review sign-off
   - Record data integrity probe results

---

## Related Documents

- [Phase A.1 Structured Error Envelopes](docs/PHASE_A1_COMPLETE.md) — Error code taxonomy
- [Phase 2C Evidence Command](docs/PHASE2C_EVIDENCE_COMMAND.md) — Runtime metadata contract
- [Phase C Reliability Roadmap](PHASE_C_RELIABILITY_ROADMAP.md) — Full Phase C scope
- [Job Contract v1](docs/JOB_CONTRACT_v1.md) — Canonical job state machine

---

## Governance Note

This reframing stays aligned with RevisionGrade governance:
- ✅ Canonical vocabulary (status, phase values are frozen)
- ✅ No new job status values invented
- ✅ Failure envelope is derived from prior canon, not new contract
- ✅ Enforcement at read boundary (mapDbRowToJob()), not in business logic
- ✅ Observability is passive (queries only; no control flow)

