# Ops Readiness Sign-Off Checklist

**Status**: ⏳ PENDING (Phase C in progress)  
**Purpose**: Final operational readiness gate before Production Readiness declaration  
**Date**: 2026-02-08  

---

## Preconditions (Must Be ✅)

| Precondition | Status | Evidence |
|--------------|--------|----------|
| Governance Authority Index reviewed | ✅ COMPLETE | [GOVERNANCE_AUTHORITY_INDEX.md](GOVERNANCE_AUTHORITY_INDEX.md) |
| Phase B closed (PRs #9, #19, #20) | ✅ COMPLETE | [GOVERNANCE_CLOSEOUT_CANONICAL_VOCABULARY.md](GOVERNANCE_CLOSEOUT_CANONICAL_VOCABULARY.md) |
| Phase C deliverables complete | ⏳ PENDING | [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md) |

---

## Operational Questions (Must Answer "Yes" to All)

### Observability

| # | Question | Yes/No | Proof Command | Notes |
|---|----------|--------|---------------|-------|
| 1 | Can I see how many jobs are running right now? | ⬜ | `SELECT COUNT(*) FROM jobs WHERE status = 'running';` | Answer in <5s |
| 2 | Can I explain why the last job failed? | ⬜ | `SELECT progress->>'failure_reason' FROM jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 1;` | Reason is human-readable |
| 3 | Can I detect stuck jobs in <30 seconds? | ⬜ | `SELECT COUNT(*) FROM jobs WHERE status = 'running' AND started_at < NOW() - INTERVAL '5 minutes';` | Query + interpretation <30s |
| 4 | Can I see retry success vs failure rate? | ⬜ | See Q3 in [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md#d3-observability-queries-proof) | Data is actionable |
| 5 | Can I identify deadlettered jobs instantly? | ⬜ | `SELECT COUNT(*) FROM deadletter_jobs;` | Table exists, query works |

### Reliability

| # | Question | Yes/No | Validation Method | Notes |
|---|----------|--------|-------------------|-------|
| 6 | Can the system run unattended for 7 days? | ⬜ | 7-day test (see [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md#7-day-unattended-operation-proof)) | Zero manual interventions required |
| 7 | Do all job failures log structured reasons? | ⬜ | Grep logs for `"event": "job:state_transition"` | Every failure has parseable JSON |
| 8 | Does every terminal state have a timestamp? | ⬜ | Schema validation | `completed_at` or `failed_at` is NOT NULL for terminal states |
| 9 | Are retry exhaustions routed to deadletter? | ⬜ | Test exhaustion, verify deadletter row | Automatic, no operator intervention |
| 10 | Is the health dashboard accurate? | ⬜ | Compare dashboard counts to SQL queries | Matches within 30s refresh window |

### Safety

| # | Question | Yes/No | Evidence | Notes |
|---|----------|--------|----------|-------|
| 11 | Are all job status values canonical? | ⬜ | Canon Guard passes | No "canceled", "retry_pending", etc. in storage |
| 12 | Are all phase values canonical? | ⬜ | Canon Guard passes | No "phase1", "p1", etc. in storage |
| 13 | Do migrations apply cleanly from empty DB? | ⬜ | CI "Fresh Database Rule" gate | Migration atomicity enforced |
| 14 | Are RPC signatures immutable? | ⬜ | Canon Guard + JOB_CONTRACT_v1 | No breaking changes to public API |
| 15 | Is TypeScript compilation boundary enforced? | ⬜ | `tsconfig.workers.json` separate | Workers don't compile `.ts` sources |

---

## Phase C Exit Criteria

**Phase C is operationally ready when:**

✅ All 15 question checkboxes above are checked  
✅ [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md) shows all deliverables complete with proof  
✅ <30s health check validated (see evidence pack)  
✅ 7-day unattended operation test passed  

---

## Production Readiness Declaration

When all criteria above are met, sign below:

**Declaration**:
> "This system is governed, observable, and operable. Failures are transparent, bounded, and diagnosable. The system can operate without manual intervention for extended periods."

**Signed Off By**: _______________________  
**Role**: _______________________  
**Date**: _______________________

**Witness (Optional)**: _______________________  
**Date**: _______________________

---

## Post-Sign-Off: Next Phase

Once Ops Readiness is signed off, proceed to:

1. **UI Confidence Polish** (2–3 days)
   - User-facing error messages
   - Loading states
   - Progress indicators

2. **Billing Integration** (3–5 days)
   - Payment processing
   - Usage tracking
   - Subscription management

3. **Final Production Readiness Review** (1 day)
   - Security audit
   - Performance benchmarks
   - Deployment checklist

4. **Go-Live** (Target: 2026-03-01)

---

## Notes

- This sign-off is **operationally binding**: once signed, the system is considered production-grade for reliability and observability.
- Future changes to observability or reliability tooling do not invalidate this sign-off unless they **break** the 15 operational questions above.
- This is **not** a general production readiness checklist — it focuses exclusively on operational hardening (Phase C scope).

---

## Related Documents

- [PHASE_C_EVIDENCE_PACK.md](PHASE_C_EVIDENCE_PACK.md) — Detailed proof for each deliverable
- [PHASE_C_RELIABILITY_ROADMAP.md](PHASE_C_RELIABILITY_ROADMAP.md) — Phase C charter
- [GOVERNANCE_AUTHORITY_INDEX.md](GOVERNANCE_AUTHORITY_INDEX.md) — What's governed
- [docs/JOB_CONTRACT_v1.md](docs/JOB_CONTRACT_v1.md) — Job contract reference

---

**Authority**: This checklist is the operational gate for Phase C completion. When all boxes are checked and signed, the system is operationally ready.
