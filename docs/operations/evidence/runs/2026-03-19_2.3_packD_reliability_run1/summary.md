# Pack D Run Summary

## Metadata
- Date: 2026-03-19
- Commit: `70a4184ae04f8db2a8742d80957fa71ceb7d0675`
- Branch: `main`
- Mode: verification
- Runner: local

## Command

`npm test -- tests/anchors/apply-integrity.test.ts tests/anchors/apply-session-atomicity.test.ts tests/anchors/apply-reliability-harness.test.ts --runInBand`

## Reliability Metrics
- valid_total: 182
- valid_pass: 182
- valid_success_rate: 100.000%
- wrong_location_edits_total: 0
- invalid_total: 3
- invalid_expected_failures: 3
- invalid_unexpected_passes: 0
- invalid_wrong_error_shape: 0

## Verdict
PASS (test-layer harness)

## Artifacts
- `packD_apply_harness.log`
- `packD_apply_reliability_report.json`
- `packD_apply_reliability_report.md`

## Notes
- Meets Pack D threshold gates (`>=99.5%` valid-anchor success and `0` wrong-location edits) on this deterministic corpus run.
