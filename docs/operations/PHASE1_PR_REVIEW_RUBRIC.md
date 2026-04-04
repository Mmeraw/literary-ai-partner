# PHASE 1 PR REVIEW RUBRIC

**Purpose:** Strict pass/fail checklist for every Phase 1 hardening PR. No PR merges unless ALL applicable gates pass.

**Authority:** GitHub (reviewer) + Canon doctrine + Operations Hardening Spec

> **This rubric defines the minimum pass/fail philosophy.** All PRs MUST also satisfy the [Phase 1 PR Template](../../.github/PULL_REQUEST_TEMPLATE.md) and [Auto-FAIL conditions](./PR_COMPACT_GATES.md).

---

## Gate 1: Retry Discipline

| Check | Pass/Fail |
|---|---|
| Retries ONLY for transient failure codes (`TRANSIENT_NETWORK`, `TRANSIENT_UPSTREAM`, `RATE_LIMITED`) | |
| Non-transient failures fail closed or dead-letter immediately | |
| Max retry count enforced globally | |
| Retries increase visibility (logged with count + failure_code) | |
| No silent retry loops | |

**Hard rule:** `if (failure_code NOT IN transient_set) { retry = false }`

---

## Gate 2: Dual Invariant Model

| Check | Pass/Fail |
|---|---|
| Runtime blocking invariants present in execution paths | |
| Assertions before finalizer (pass artifacts exist, schema valid) | |
| Assertions before status transition (`isValidTransition()`) | |
| Assertions before report render (canonical artifact exists, validated) | |
| Audit/detection invariants present in scripts or CI | |

---

## Gate 3: Finalizer as Sole Truth Gate

| Check | Pass/Fail |
|---|---|
| No terminal `complete` status set outside `finalizeJob()` | |
| No report without validated canonical artifact | |
| No partial-complete state anywhere in code | |
| `finalizeJob()` validates: all pass artifacts exist, schema valid, no orphan reasoning, no phantom anchors, evidence aligned | |
| Invalid artifact = no artifact (binary, fail-closed) | |

---

## Gate 4: No Shortcut Exceptions

| Check | Pass/Fail |
|---|---|
| No "temporary bypass" without explicit guard + audit trail + expiry | |
| No `// TODO: fix later` on safety-critical paths | |
| No default fill for missing required fields | |
| No fuzzy matching or fallback search in extraction/apply | |

---

## Gate 5: State Machine Integrity

| Check | Pass/Fail |
|---|---|
| Only canonical states used: `queued \| running \| complete \| failed` | |
| `isValidTransition()` is sole gatekeeper for all status changes | |
| Invalid transitions throw typed errors with context | |
| DB enum matches TS enum exactly | |

---

## Gate 6: Failure Classification

| Check | Pass/Fail |
|---|---|
| Every failure emits canonical `failure_code` | |
| Every failure includes `failure_envelope` + `last_error` | |
| No `UNKNOWN` or generic fallback codes | |
| Deterministic 1:1 mapping between condition and code | |
| `unclassified_failures_total` must remain 0 | |

---

## Gate 7: Anchor Contract

| Check | Pass/Fail |
|---|---|
| `start_offset` inclusive, `end_offset` exclusive | |
| `start_offset >= end_offset` rejected at all layers | |
| Context matches deterministically | |
| No partial or fuzzy matches | |
| Parity across DB, TS, and runtime validator | |

---

## Gate 8: Pass Artifact Separation (RG-OPS-024)

| Check | Pass/Fail |
|---|---|
| Each pass produces isolated `PassArtifact` with provenance | |
| `pass1_artifact_id`, `pass2_artifact_id`, `pass3_artifact_id` all required before convergence | |
| No early collapse of results into single artifact | |
| Each pass artifact persisted separately in DB | |
| No summary computation before finalizer validates all passes | |

---

## Gate 9: Observability

| Check | Pass/Fail |
|---|---|
| Every state transition logged with `job_id` + timestamp | |
| Every failure logged with code + anchor data + context + `job_id` | |
| Evidence captured under `docs/operations/evidence/` | |

---

## Gate 10: Canon Alignment

| Check | Pass/Fail |
|---|---|
| PR references relevant RG-OPS issue(s) | |
| Changes align with `OPERATIONS_HARDENING_SPEC.md` | |
| No new fields/entities outside `GOLDEN_SPINE.md` without spec update | |
| No regression on existing pack test suites | |

---

## Gate 11: Finalizer Authority (hard stop)

| Check | Pass/Fail |
|---|---|
| No code path sets `job.status = "complete"` outside Finalizer | |
| Finalizer validates ALL required artifacts before completion | |
| No partial-complete states possible | |
| No report render without Finalizer-approved canonical artifact | |
| Finalizer decisions reconstructable from logs and persisted state | |

**Hard rule:** Any PR that touches completion logic MUST prove Finalizer is sole authority.

---

## Gate 12: Pass Artifact Integrity

| Check | Pass/Fail |
|---|---|
| pass1, pass2, pass3 artifacts stored separately (distinct IDs, distinct rows) | |
| No early merge/collapse of pass outputs | |
| Convergence step is explicit and auditable | |
| Missing pass artifact blocks finalization | |
| Pass artifact schema validated before convergence | |

**Hard rule:** Any PR that touches pass artifacts or convergence MUST prove separation is maintained.

---

## Verdict

**PASS:** All applicable gates pass. PR approved for merge.

**FAIL:** Any gate fails. PR blocked. Specific gate failure must be remediated before re-review.

---

## Enforcement Stack Reference

1. Schema (DB constraints)
2. Types (TypeScript)
3. Runtime guards (transitions, finalizer, invariants)
4. Pipeline control (passes, convergence, eligibility)
5. Audit layer (invariant scripts, soak tests, chaos tests)

If any one layer weakens, the others must catch it.

---

## References

- `docs/operations/OPERATIONS_HARDENING_SPEC.md`
- `docs/operations/OPERATIONS_HARDENING_RUNBOOK.md`
- `docs/GOLDEN_SPINE.md`
- GitHub Issues #52-#75 (RG-OPS-001 through RG-OPS-024)
