# Pass 2 Incomplete-Chunk Selective Recovery Contract

Tracks #1426.

## Purpose

Recover from a malformed Pass 2 chunk that omits one or more required criteria without replaying verified chunks or weakening fail-closed validation.

Production evidence:

```text
PASS2_OUTPUT_INCOMPLETE
missing_criteria=["marketability"]
```

## Validation authority

`PASS2_OUTPUT_INCOMPLETE` remains the canonical fail-closed validation result. Missing criteria are never synthesized, defaulted, or backfilled.

## Root-cause classification

Diagnostics should distinguish, when determinable:

- provider output omission
- structured-output decoding failure
- parser loss
- transport/truncation
- normalization loss

Unknown origin remains explicit rather than guessed.

## Selective retry classification

A chunk missing required criteria is selectively retryable within the existing bounded retry policy.

The retry unit is the malformed chunk only. Verified chunks remain authoritative and immutable.

## Preserved evidence

For every verified chunk preserve unchanged:

- chunk identity
- canonical output bytes or canonical serialization
- chunk hash
- cache/checkpoint provenance
- retry/replay evidence

## Repair contract

The failed chunk is re-run with an explicit requirement to return a complete 13-criterion payload. The repaired payload must pass the same canonical validation as any fresh successful Pass 2 output before aggregation.

The recovery path must not:

- replay verified chunks
- synthesize missing criteria
- aggregate both malformed and repaired versions
- overwrite successful chunks
- silently relax the completeness gate

## Exactly-once aggregation

After successful repair, canonical aggregation must contain all 30 chunk contributions exactly once.

It must reject:

- missing chunk contribution
- duplicate contribution
- stale malformed contribution alongside repaired output
- successful chunk overwrite
- hash drift in unaffected chunks

## Retry exhaustion

If the bounded retry is exhausted, terminal diagnosis remains:

```text
PASS2_OUTPUT_INCOMPLETE
```

Internal diagnostics include:

- chunk ID
- missing criteria
- retry count
- root-cause classification when known

## Acceptance proof

Use a production-shape fixture with 29 valid cached chunks and one chunk missing `marketability`.

Tests must prove:

- only the malformed chunk is invoked on retry
- the 29 verified outputs and hashes are unchanged
- the repaired chunk passes canonical validation
- final aggregation has all 30 chunks exactly once
- all 13 criteria are present
- malformed pre-retry output is not aggregated
- replay after recovery performs no unnecessary work
- retry exhaustion preserves the named diagnosis and exact chunk/criterion details
