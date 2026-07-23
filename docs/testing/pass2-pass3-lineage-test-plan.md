# Pass 2 → Pass 3 Lineage Test Plan

Tracks #1425.

## Production-shape fixture

Use 30 Pass 2 chunks spanning all 13 criteria. Every meaningful source has immutable provenance captured at Pass 2 aggregation.

## Required scenarios

1. Complete explicit lineage produces a complete ledger.
2. Partial lineage preserves explicit mappings and reconciles remaining sources through the same boundary.
3. Mixed materialized, consolidated, and suppressed outcomes reconcile exactly once.
4. Absent lineage permits only uniquely provable one-to-one materializations.
5. Ambiguous one-to-many or many-to-one matching fails closed.
6. Duplicate source assignment fails closed.
7. Unknown source identity fails closed.
8. A target recommendation removed from the canonical result cannot remain materialized.
9. Invalid consolidation or suppression fails closed.
10. Cache reload produces the same source manifest.
11. Selective retry leaves unaffected chunk outputs and hashes unchanged.
12. Replay produces the identical canonical ledger and performs no additive writes.
13. A second reconciliation pass is idempotent.
14. The one Phase 3 re-kick preserves all source IDs, criterion assignments, chunk IDs, and chunk hashes.
15. Chunk-hash mismatch across re-kick fails closed.
16. Persistence interruption commits neither canonical result nor ledger.
17. Retry after persistence interruption creates no duplicate ledger rows.
18. Persisted reload reconstructs the identical canonical result/ledger binding.
19. Ledger contains no raw manuscript or recommendation prose.

## Assertions

For every successful scenario:

- source count equals the canonical Pass 2 source-manifest count
- each source appears exactly once
- outcome is exactly one of materialized, consolidated, or suppressed
- all 30 chunk identities and hashes are represented as expected
- all 13 criteria are represented
- canonical serialization/fingerprint is stable

For every failure scenario:

- public error remains `CRITERION_OPPORTUNITY_COVERAGE_INVALID`
- an exact internal lineage subcode is recorded
- no partial canonical result or ledger is persisted
