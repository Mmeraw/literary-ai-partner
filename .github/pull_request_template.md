## Summary

Describe the change in 2–5 sentences.

## Change Type

- [ ] Restore / relocation
- [ ] Harness / test repair
- [ ] Runtime behavior change
- [ ] Migration / schema
- [ ] RLS / auth / security
- [ ] Docs / planning
- [ ] Refactor
- [ ] Ops / scripts

## What Changed

- 
- 
- 

## Why

Explain why this change is needed.

## Risk Level

- [ ] Low
- [ ] Medium
- [ ] High

## Validation

- [ ] Build passes
- [ ] Tests pass
- [ ] Guard scripts pass
- [ ] Migration reviewed
- [ ] RLS reviewed
- [ ] Manual verification completed

Evidence:
- 

## Behavior Impact

- [ ] No runtime behavior change
- [ ] Runtime behavior changed intentionally

If behavior changed, explain exactly how:
- 

## Database / Security Impact

- [ ] No DB or security impact
- [ ] DB schema changed
- [ ] RLS/policies changed
- [ ] Secrets/auth/access changed

Details:
- 

## Governance Checklist (Required)

- [ ] No changes to JobStatus, transitions, or progress semantics
- [ ] JOB_CONTRACT_v1 compliance verified
- [ ] No new job states or aliases introduced
- [ ] Observability added is passive only
- [ ] Errors are classified correctly (4xx vs 5xx)

## Canon Impact

- [ ] No canon changes
- [ ] Canon change (requires version bump + migration plan)

## Rollback Plan

Describe how to revert safely.

## Follow-ups


## Blast-Radius Check (Required for invariant-tightening PRs)

<!-- Fill this section if this PR adds or tightens an enforce*/assert* invariant -->

- [ ] Shared valid fixtures still satisfy the new invariant
- [ ] Success-path tests using pass artifacts still use canon-complete fixtures
- [ ] No local minimal fixture is pretending to be a valid release-path artifact
- [ ] PassArtifact shape, CRITERIA_KEYS, and fixture builders still align (triangle check)
- [ ] At least one downstream integration/success-path suite was re-run
- [ ] Fixture Canon Guard CI job passes
List anything intentionally deferred.
