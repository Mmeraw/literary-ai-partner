# PR Author Self-Check

> Complete this checklist BEFORE requesting review.
> Every unchecked item requires explicit justification in the PR description.

## Code Quality
- [ ] Every changed file has a corresponding test or explicit justification why not
- [ ] No new `console.log` without structured metadata (`count`, `failure_code`, `revision_id`)
- [ ] No silent catches — every `catch` block logs or re-throws
- [ ] No hardcoded magic numbers — all thresholds from config or constants
- [ ] No `any` types introduced without justification

## Retry & Error Handling
- [ ] Retry paths tested with transient AND non-transient failure codes
- [ ] Non-transient failures fail immediately (no retry)
- [ ] Max retry count enforced and configurable
- [ ] Every retry logged with count + failure_code

## State Machine
- [ ] State transitions validated: only legal transitions from current state
- [ ] Invalid state transitions throw (not silently ignored)
- [ ] No state can be skipped in the lifecycle

## Smoke Loop
- [ ] Smoke loop verified locally: create -> process -> complete -> render
- [ ] Each stage produces the expected artifact for the next stage
- [ ] Pass artifact separation maintained (content vs. metadata vs. scores)

## Doctrine
- [ ] Canon docs referenced in PR description match actual behavior
- [ ] No behavioral change without corresponding canon update
- [ ] PR description includes which RG-OPS issue this closes

## Final Check
- [ ] CI passes locally before push
- [ ] Diff reviewed for accidental inclusions (debug code, credentials, TODOs)
- [ ] PR title follows format: `type(scope): description`

---

**If any box is unchecked**, explain why in the PR description under "Exceptions".
No exceptions without justification = auto-reject by reviewer.
