# PR: Truthful Fallback for Missing Criterion Analyses in Pass 3b Long-Form DREAM (#538)

## Summary

This PR adds a deterministic truthful fallback at the Pass 3b long-form synthesis boundary.

If the model omits or malformedly returns `criterion_analyses` entries, the pipeline now:

- restores one entry per Pass 3 criterion key
- preserves valid existing model fields when present
- repairs malformed fields deterministically
- enforces score parity with Pass 3 (`final_score_0_10`)
- logs which criterion keys were auto-filled or repaired for auditability

## Changes

1. **Pass 3b fallback logic**
   - File: `lib/evaluation/pipeline/runPass3bLongform.ts`
   - Added `applyTruthfulLongformCriteriaFallback(...)`
   - Applies reconciliation before `validateDreamDocument(...)`
   - Emits a `truthful_fallback_applied` warning log payload with repaired/autofilled keys

2. **Regression tests**
   - File: `tests/evaluation/pipeline/truthfulFallback.pass3b.test.ts`
   - Verifies missing criterion analyses are auto-filled deterministically
   - Verifies malformed entries are repaired without overwriting valid arrays
   - Verifies score alignment to Pass 3 ledger values

## Validation

- [x] `tests/evaluation/pipeline/truthfulFallback.pass3b.test.ts`
- [x] `tests/evaluation/pipeline/pass3.test.ts`

## Hardening guarantees

- deterministic fallback behavior
- no silent criterion loss in long-form §7 analysis
- no score drift from Pass 3 ledger
- explicit audit signal when fallback activates

## Scope

- Pass 3b long-form document synthesis only
- no UI, renderer, or benchmark contract changes
