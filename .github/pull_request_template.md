## Governance Checklist (Required)

- [ ] No changes to JobStatus, transitions, or progress semantics
- [ ] JOB_CONTRACT_v1 compliance verified
- [ ] No new job states or aliases introduced
- [ ] Observability added is passive only
- [ ] Errors are classified correctly (4xx vs 5xx)

## Enforcement Checklist (Required for classifier/orchestrator/Wave 64/benchmark fixtures/dialogue)

- [ ] I ran `npm test -- tests/unit/benchmark-truth-cases.test.ts --runInBand`
- [ ] Protected dialogue remains immutable (no line merge / phrase rewrite / cadence loss)
- [ ] Canonical fixture wiring resolves (manuscript + markers)
- [ ] No generated benchmark artifacts are tracked
- [ ] No fallback source status is active (`canonical_source_not_found_in_repo`)
- [ ] No benchmark-specific or chapter-specific runtime branching was introduced

## Issue #47 Completion Gate (Dialogue Protection)

- [ ] Classification logic implemented (or explicitly deferred)
- [ ] Execution barrier implemented (or explicitly deferred)
- [ ] Validation layer implemented (or explicitly deferred)
- [ ] Unit tests added/updated
- [ ] Benchmark / fixture impact reviewed

## Change Disclosure

- [ ] Files changed are listed in Description
- [ ] Architectural drift risk is documented in Notes
- [ ] Doctrine/canon impact is documented in Canon Impact

## Canon Impact
- [ ] No canon changes
- [ ] Canon change (requires version bump + migration plan)

## Description
<!-- Describe your changes here -->

<!-- Include: key files changed and why -->

## Testing
<!-- Describe how you tested these changes -->

<!-- Include compile/lint/unit/benchmark results -->

## Notes
<!-- Explain any governance-relevant decision here -->
