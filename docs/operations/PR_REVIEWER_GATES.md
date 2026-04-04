# PR Reviewer Gates

> Structured review protocol for Phase 1 hardening PRs.
> Reviewer MUST complete this before approving.

## Pre-Review
- [ ] PR template is fully filled out (no empty sections)
- [ ] Author self-check is completed (all boxes checked or justified)
- [ ] CI is green
- [ ] PR references a specific RG-OPS issue

## Gate-by-Gate Review

For each gate checked by the author, verify:

### Gate 1: Retry Discipline
- [ ] Retries only fire on `TRANSIENT_NETWORK`, `TRANSIENT_UPSTREAM`, `RATE_LIMITED`
- [ ] Non-transient failures fail closed immediately
- [ ] Max retry count enforced globally
- [ ] Retries logged with count + failure_code
- [ ] No silent retry loops

### Gate 2: State Machine Integrity
- [ ] All transitions validated against allowed transitions map
- [ ] Invalid transitions throw (not silently dropped)
- [ ] Terminal states are truly terminal
- [ ] No state can be skipped

### Gate 3: Idempotency
- [ ] Re-running the same operation produces identical results
- [ ] Duplicate submissions detected and rejected
- [ ] Database operations use upsert or conflict resolution

### Gate 4: Timeout / Lease Hygiene
- [ ] Every async operation has an explicit timeout
- [ ] Leases expire and are reclaimed
- [ ] No infinite waits or unbounded polling

### Gate 5: Dead-Letter / Poison Pill
- [ ] Failed items that exceed retry are dead-lettered
- [ ] Poison pills don't block the queue
- [ ] Dead-letter items are inspectable

### Gate 6: Observability
- [ ] Structured logs with revision_id, count, failure_code
- [ ] No bare console.log without metadata
- [ ] Error paths produce actionable log output

### Gate 7: Smoke-Loop Proof
- [ ] End-to-end path verified: create -> process -> complete -> render
- [ ] Each stage artifact is correct for the next stage

### Gate 8: Regression Safety
- [ ] No existing tests broken
- [ ] New paths have corresponding tests
- [ ] Edge cases covered (empty input, null, timeout)

### Gate 9: Doctrine Traceability
- [ ] Every behavioral change references a canon document
- [ ] Canon doc and code behavior match

### Gate 10: Canon Compliance
- [ ] No invariant violations introduced
- [ ] No undocumented behavioral changes

## Reviewer Verdict
- [ ] **APPROVE** — All applicable gates pass
- [ ] **REQUEST CHANGES** — Specific gate failures listed below
- [ ] **REJECT** — Auto-fail condition triggered

### Gate Failures (if any):
<!-- List specific failures here -->

---

**Reference:** [PHASE1_PR_REVIEW_RUBRIC.md](./PHASE1_PR_REVIEW_RUBRIC.md) | [PR_COMPACT_GATES.md](./PR_COMPACT_GATES.md)
