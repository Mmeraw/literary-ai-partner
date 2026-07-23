# Pass 2 Incomplete-Chunk Selective Retry Test Plan

Tracks #1426.

## Production-shape fixture

- 30 expected chunks
- 29 valid cached canonical outputs
- 1 malformed chunk missing `marketability`
- hashes recorded for all verified chunks

## Required scenarios

1. Provider output omits one required criterion.
2. Parser receives a complete payload but loses a criterion, proving origin classification.
3. Structured-output decoding produces an incomplete object.
4. Selective retry invokes only the malformed chunk.
5. Successful repair passes the ordinary canonical 13-criterion validator.
6. The malformed pre-retry output is replaced, not co-aggregated.
7. All 29 unaffected outputs remain byte/canonical-serialization and hash identical.
8. Final aggregation contains exactly 30 unique chunk contributions.
9. Every aggregated chunk contains all 13 required criteria.
10. A retry returning another incomplete payload remains fail-closed.
11. Retry exhaustion records `PASS2_OUTPUT_INCOMPLETE`, chunk ID, missing criteria, retry count, and origin classification when known.
12. Replay after successful recovery performs zero unnecessary provider calls.
13. Cache reload after recovery produces the identical chunk set and hashes.
14. Duplicate repaired contribution is rejected.
15. Successful-chunk overwrite is rejected.
16. Hash drift in an unaffected chunk is rejected or diagnosed explicitly.

## Required assertions

- Provider invocation set equals only the failed chunk ID.
- Verified chunk hashes before and after recovery are identical.
- Repaired chunk is validated using the canonical parser/validator path.
- Aggregated chunk IDs are unique and equal the expected 30-ID set.
- No criterion is synthesized by orchestration.
- Terminal failure retains the public fail-closed diagnosis.
