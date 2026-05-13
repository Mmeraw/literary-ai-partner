# Pipeline Stress Harness — Tier 1 Summary

- Total rows: 22
- Passed assertions: 22
- Failed assertions: 0
- Rows exposing real bugs (current behavior diverges from expected): 0

Rows below are sorted by id for byte-deterministic output. Timing columns are advisory; the only blocking assertion on timing is `total_ms < 2 × bucket budget` (anti-flake rule 2).

## Per-row results

| id | bucket | faults | expected | actual | error_code | assertions |
|---|---|---|---|---|---|---|
| C-100k-tok | W-100k | chunk:single-100k-token | fail | fail | CHUNK_BUDGET_OVERFLOW | OK |
| C-chapter-straddle | W-60k | chunk:chapter-straddle | success | success |  | OK |
| C-empty | W-25k | chunk:empty | success | success |  | OK |
| C-single-tok | W-25k | chunk:single-token | fail | fail | PIPELINE_INPUT_INVALID | OK |
| L-429 | W-25k | llm:rate-limit | fail | fail | PASS1_FAILED | OK |
| L-500 | W-25k | llm:server-error | fail | fail | PASS1_FAILED | OK |
| L-empty-obj | W-25k | llm:empty-object | fail | fail | PASS1_FAILED | OK |
| L-empty-str | W-25k | llm:empty-string | fail | fail | PASS1_FAILED | OK |
| L-finish-length | W-25k | llm:finish-length | fail | fail | PASS1_FAILED | OK |
| L-hang-30s | W-25k | llm:hang | fail | fail | PASS1_TIMEOUT | OK |
| L-hang-60s | W-25k | llm:hang | fail | fail | PASS1_TIMEOUT | OK |
| L-hang-90s | W-137k | llm:hang | fail | fail | PASS1_TIMEOUT | OK |
| L-truncated-json | W-25k | llm:truncated-json | fail | fail | PASS1_FAILED | OK |
| M-no-chap | W-137k | manuscript:no-chapters | success | success |  | OK |
| S-disconnect-mid-job | W-25k | sb:{"disconnectAfterCalls":2} | fail | fail | PERSISTENCE_FAILED | OK |
| S-rpc-not-function | W-5k | sb:{"omitRpc":true} | fail | fail | PERSISTENCE_FAILED | OK |
| W-100k | W-100k | none | success | success |  | OK |
| W-137k | W-137k | none | success | success |  | OK |
| W-200k | W-200k | none | success | success |  | OK |
| W-25k | W-25k | none | success | success |  | OK |
| W-5k | W-5k | none | success | success |  | OK |
| W-60k | W-60k | none | success | success |  | OK |

## Rows that exposed real bugs

_None — every row's observed behavior matched its expected outcome._
