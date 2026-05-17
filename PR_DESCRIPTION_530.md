# PR: Pass 1 Weak-Criteria Prompt Discipline (#530)

## Summary

This PR adds deterministic weak-criteria discipline to Pass 1 (craft execution) outputs.

When a criterion score is at or below the configured threshold, Pass 1 now flags it with stable reason codes so downstream stages (Pass 2/3/4, governance, and audits) can treat low-confidence craft signal explicitly instead of silently.

## Changes

1. **Weak criteria helper**
   - `lib/evaluation/pipeline/weakCriteriaCheck.ts`
   - Adds deterministic threshold resolution (`EVAL_PASS1_WEAK_CRITERIA_THRESHOLD`, default `4`)
   - Annotates weak criteria with reason codes:
     - `PASS1_WEAK_CRITERION`
     - `PASS1_REMEDIATION_REQUIRED`
     - `PASS1_WEAK_THRESHOLD_LE_<N>`

2. **Pass 1 integration**
   - `lib/evaluation/pipeline/runPass1.ts`
   - Applies weak-criteria annotation in both:
     - direct-window Pass 1 path
     - chunk-map-reduce aggregation path
   - Emits audit log `weak_criteria_flagged` with threshold and criterion keys

3. **Regression tests**
   - `tests/evaluation/pipeline/pass1-weakCriteria.test.ts`
   - Validates deterministic flagging behavior
   - Validates non-weak criteria are not altered
   - Validates default threshold behavior

## Validation

- [x] `tests/evaluation/pipeline/pass1-weakCriteria.test.ts`
- [x] `tests/evaluation/pipeline/pass1.test.ts`

## Hardening impact

- Deterministic, machine-readable low-signal flags
- No silent weak-criteria omission
- Preserves existing Pass 1 contracts and parser behavior
- Works for both short-form and chunked long-form routing

## Scope

- Pass 1 output enrichment only
- No UI, renderer, benchmark, or provider-routing changes
