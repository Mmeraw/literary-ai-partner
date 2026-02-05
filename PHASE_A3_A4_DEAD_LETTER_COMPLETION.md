# Phase Completion Record — Phase A.3 / A.4
Status: COMPLETE  
Scope: Dead-letter path reliability (error-code canon + real TS gate)  
Branch: phase-a3a4-dead-letter-clean  
Date: 2026-02-05

## Executive Summary
This phase closes the dead-letter path by removing non-canonical ERROR_CODES references and aligning implementation + tests to the repo's canonical error taxonomy. It also establishes a real TypeScript compilation gate for the reliability slice (in addition to Jest), preventing "green tests / red types" drift.

## What Changed
### Code
- lib/reliability/deadLetter.ts
  - Removed phantom ERROR_CODES: AUTH_ERROR, INVALID_INPUT, UNSUPPORTED_MODEL
  - Implemented non-retryable classification using canonical ERROR_CODES
- lib/reliability/deadLetter.test.ts
  - Updated tests to use canonical ERROR_CODES
  - Coverage: 33 test cases validating terminal failure, retry behavior, claimability, and legal transitions

### Governance / Evidence
- This record provides reproducible verification commands and expected outcomes.
- Infrastructure / mixed-runtime issues (Deno vs Node TS) are explicitly out of scope and tracked separately.

## Acceptance Criteria (Now True)
1) No phantom ERROR_CODES remain in dead-letter implementation/tests.  
2) Slice-scoped TypeScript compilation passes for reliability files.  
3) Jest tests pass for dead-letter suite.  
4) Behavioral contract enforced:
   - non-retryable errors fail immediately
   - retryable errors continue until max attempts
   - idempotency: "already failed" remains terminal

## Verification Evidence
Run these commands from repo root:

### A) Prove phantom codes are gone
Command:
  rg -n "ERROR_CODES\\.(AUTH_ERROR|INVALID_INPUT|UNSUPPORTED_MODEL)" lib/reliability/deadLetter.ts lib/reliability/deadLetter.test.ts
Expected:
  (no matches)

### B) TypeScript gate (slice-scoped)
Command:
  npx tsc --noEmit lib/reliability/deadLetter.ts lib/reliability/deadLetter.test.ts; echo "tsc_exit=$?"
Expected:
  tsc_exit=0

Optional: compile all reliability TS files without glob pitfalls:
Command:
  find lib/reliability -name "*.ts" -print0 | xargs -0 npx tsc --noEmit; echo "tsc_exit=$?"
Expected:
  tsc_exit=0

### C) Jest
Command:
  npx jest lib/reliability/deadLetter.test.ts --verbose
Expected:
  Test Suites: 1 passed
  Tests:       33 passed

## Out of Scope / Follow-ups
- Repo-wide TypeScript vs Deno test separation is not addressed in this PR.
- A follow-up issue is provided in GITHUB_ISSUE_DENO_TS_SEPARATION.md.

## Phase Outcome
Phase A.3 / A.4 is COMPLETE for the dead-letter path: implementation and tests are canon-aligned and verified by a real TypeScript compilation gate plus Jest.
