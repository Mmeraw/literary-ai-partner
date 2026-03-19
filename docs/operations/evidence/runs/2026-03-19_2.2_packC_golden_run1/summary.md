# Pack C Run Summary

## Metadata
- Date: 2026-03-19
- Commit: `70a4184ae04f8db2a8742d80957fa71ceb7d0675`
- Branch: `main`
- Mode: verification
- Runner: local

## Command

`npm test -- tests/anchors/extraction-contract.test.ts tests/anchors/extraction-golden-corpus.test.ts --runInBand`

## Results
- Test Suites: 2 passed, 2 total
- Tests: 24 passed, 24 total
- Verdict: PASS (test-layer golden corpus)

## Golden Coverage
- CRLF/LF
- Unicode accents
- em dashes
- mixed smart/curly quotes
- multiline dialogue
- tricky punctuation boundaries
- whitespace-sensitive spans

## Notes
- Golden corpus validates exact extraction contract behavior on edge-case text shapes.
- Fail-closed off-by-one mismatch assertion included in corpus suite.
