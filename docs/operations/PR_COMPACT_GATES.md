# PR Compact Gates Checklist

> Quick-reference version of [PHASE1_PR_REVIEW_RUBRIC.md](./PHASE1_PR_REVIEW_RUBRIC.md).
> Use this for rapid gate verification during review.

## Reviewer Compact Checklist

| # | Gate | Pass? |
|---|------|-------|
| 1 | Retries only on transient codes, max enforced, logged | |
| 2 | State transitions validated, no illegal jumps | |
| 3 | Operations idempotent (safe re-run produces same result) | |
| 4 | Timeouts explicit, leases expire, no infinite waits | |
| 5 | Poison pills dead-lettered, not retried forever | |
| 6 | Structured logs with revision_id, count, failure_code | |
| 7 | Smoke loop proven: create -> process -> complete -> render | |
| 8 | No existing test broken, no untested path added | |
| 9 | PR references canon doc for every behavioral change | |
| 10 | No canon violation, no undocumented invariant change | |

## Auto-Fail (any one blocks merge)
- [ ] CI red
- [ ] Untested changed path
- [ ] Silent retry loop
- [ ] Unvalidated state transition
- [ ] Missing doctrine reference

---

**Full rubric:** [PHASE1_PR_REVIEW_RUBRIC.md](./PHASE1_PR_REVIEW_RUBRIC.md)
