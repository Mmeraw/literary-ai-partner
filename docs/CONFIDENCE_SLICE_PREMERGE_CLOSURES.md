# Confidence Slice — Pre-Merge Closure Notes

Date: 2026-04-25

## 1) Quality gate softening lock (implemented)

Policy lock for `runQualityGateV2`:
- `SCORABLE` + `scorability_status="scorable_low_confidence"` with below-threshold anchors is warning-only.
- Fully scorable criteria (`scorability_status="scorable"`) remain hard-fail when below threshold.
- `non_scorable` criteria do not emit low-confidence scored warnings.

Implemented in:
- `lib/evaluation/pipeline/qualityGate.ts` (policy comments + narrow exemption logic)
- `lib/evaluation/pipeline/__tests__/qualityGateV2.test.ts` (regression tests)

## 2) Ledger denominator policy (Option A for this PR)

Current policy is explicitly documented:
- Ledger denominator remains canonical/full criteria-set based for this PR slice.
- `non_scorable` affects confidence/scorability status and gate behavior, not denominator math in this slice.

Documented in:
- `lib/evaluation/pipeline/buildScoreLedger.ts`

Follow-up:
- Scorable-only denominator is intentionally deferred to a dedicated follow-up PR to avoid scope ballooning.

## 3) Typecheck carve-out (baseline issue)

`npx tsc --noEmit` currently fails on pre-existing config test typing, unrelated to this confidence slice:
- `lib/config/__tests__/envContract.test.ts`
- `lib/config/__tests__/productionConfigValidation.test.ts`

These failures are baseline and should be tracked as separate cleanup work.

## Verification status

Passing focused suites:
- `tests/lib/evaluation/criterionConfidence.test.ts`
- `tests/lib/evaluation/criterionConfidence.calibration.test.ts` (skip when no fixtures)
- `tests/lib/evaluation/warningClassification.test.ts`
- `lib/evaluation/pipeline/__tests__/qualityGateV2.test.ts`
- `lib/evaluation/pipeline/__tests__/buildScoreLedger.test.ts`
- `lib/evaluation/pipeline/__tests__/validateEvaluationArtifact.test.ts`
- `__tests__/lib/evaluation/processor.real-gate.test.ts`
