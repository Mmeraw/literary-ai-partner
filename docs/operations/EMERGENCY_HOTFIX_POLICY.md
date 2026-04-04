# Emergency Hotfix Policy

> When production is broken and the smoke loop is down.

## When This Applies
- Production deployment is serving errors to users
- Smoke loop (create -> process -> complete -> render) is broken
- Data corruption is actively occurring

## Emergency Hotfix Process

### 1. Declare Emergency
- Open a GitHub issue titled `HOTFIX: [brief description]`
- Label: `hotfix`, `priority:critical`
- Tag @Mmeraw immediately

### 2. Minimal Fix Only
- Fix ONLY the broken path
- No refactoring, no cleanup, no feature additions
- Maximum diff: smallest change that restores the smoke loop

### 3. Reduced Gate Requirements
During emergency, the following gates are **required** (cannot skip):
- [ ] Gate 7: Smoke-Loop Proof (the whole point)
- [ ] Gate 8: Regression Safety (don't break something else)
- [ ] Gate 10: Canon Compliance (no invariant violations)
- [ ] Gate 11: Finalizer Authority (Finalizer truth gate CANNOT be bypassed — wrong output is worse than no output)
The following gates are **deferred** (must be addressed in follow-up PR within 48h):
- Gates 1-6, 9: Retry, state machine, idempotency, timeout, dead-letter, observability, doctrine traceability

### 4. Merge Policy (Emergency)
- CI must still pass (no exceptions)
- Single reviewer approval sufficient (normally requires full gate check)
- Commit message format: `hotfix: [description] (emergency, follow-up required)`

### 5. Mandatory Follow-Up
- Within 48 hours: open a PR that applies ALL 10 gates to the hotfix code
- Link the follow-up PR to the original hotfix issue
- If follow-up is not filed within 48h, the hotfix area is flagged for immediate review

## What Is NOT an Emergency
- Slow performance (unless timeout/lease causing data loss)
- UI cosmetic issues
- Test failures in non-production paths
- Feature requests from any source

---

**Reference:** [PHASE1_PR_REVIEW_RUBRIC.md](./PHASE1_PR_REVIEW_RUBRIC.md)
