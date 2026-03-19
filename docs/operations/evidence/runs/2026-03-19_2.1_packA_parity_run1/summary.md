# Pack A Run Summary

## Metadata
- Date: 2026-03-19
- Commit: `70a4184ae04f8db2a8742d80957fa71ceb7d0675`
- Branch: `main`
- Mode: verification
- Runner: local

## Command

`npm test -- tests/anchors/anchor-validation.test.ts tests/anchors/extraction-contract.test.ts tests/anchors/anchor-parity-contract.test.ts --runInBand`

## Results
- Test Suites: 3 passed, 3 total
- Tests: 36 passed, 36 total
- Verdict: PARTIAL (target DB verification pending)

## Invariant Signals
- `start_offset >= end_offset` rejection: PASS
- negative `start_offset` rejection: PASS
- extraction fail-closed on invalid offsets: PASS

## Remaining for Full Pack A Sign-Off
- Execute `tests/anchors/phase21-db-verification.sql` in target DB.
- Archive DB verification output (`phase21-db-verification.log`) under this run directory.
