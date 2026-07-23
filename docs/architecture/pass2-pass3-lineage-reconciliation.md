# Pass 2 → Pass 3 Lineage Reconciliation Contract

Tracks #1425.

## Purpose

Guarantee that every meaningful canonical Pass 2 discovery has one immutable source identity and exactly one final governed Pass 3 outcome.

## Immutable Pass 2 source manifest

Create source records at canonical Pass 2 aggregation, never later in Pass 3:

- `source_id`
- `criterion_key`
- `origin_chunk_id`
- `origin_chunk_hash`
- `source_fingerprint`
- `source_version`

The manifest is authoritative and immutable through cache reload, selective retry, replay, Pass 3 handoff, and the one permitted Phase 3 re-kick.

## Reconciliation boundary

All complete, partial, mixed, and absent model lineage responses pass through one deterministic and idempotent reconciler after parsing and normalization of retry/replay, deduplication, consolidation, and suppression outcomes.

Required property:

```text
reconcile(reconcile(input)) = reconcile(input)
```

Stable ordering and canonical serialization are required so identical inputs produce an identical ledger.

## Permitted inference

The reconciler may infer only a uniquely provable one-source-to-one-surviving-recommendation materialization.

It must never invent:

- suppression
- consolidation
- recommendation content
- source identity
- fuzzy lineage merely to satisfy coverage

Ambiguity remains fail-closed.

## Exactly-once outcomes

Every source resolves exactly once as:

- `materialized`
- `consolidated`
- `suppressed`

Zero outcomes and multiple outcomes are terminal defects.

## Durable ledger

Persist a complete source-to-outcome ledger containing identifiers and governance evidence references, but no raw manuscript or recommendation prose.

Minimum contract:

- source provenance fields from the immutable manifest
- `outcome_type`
- `target_recommendation_id` when materialized or consolidated
- `consolidated_into_source_id` or group identity when applicable
- suppression rule and rationale/evidence references when suppressed
- canonical artifact version/fingerprint

## Atomic persistence

The canonical result and complete ledger share one commit boundary. Persistence must reject:

- canonical result without ledger
- ledger against a different artifact version
- partial ledger rows
- duplicate rows after retry/replay
- source provenance overwritten during re-kick

## Diagnostics

Public failure remains:

```text
CRITERION_OPPORTUNITY_COVERAGE_INVALID
```

Internal diagnostics should distinguish missing outcomes, multiple outcomes, unknown source IDs, noncanonical targets, ambiguous materialization, invalid suppression/consolidation, chunk-hash mismatch, re-kick provenance mismatch, and persistence failure.

## Re-kick provenance envelope

The one permitted Phase 3 re-kick must carry and validate:

- Pass 2 source-set fingerprint
- all 30 chunk IDs and hashes
- source count
- criterion count
- original attempt identity

Only Pass 3 outcomes may change.

## Acceptance proof

Tests must prove:

- 30 chunks and all 13 criteria represented
- exactly one outcome per source
- complete, partial, mixed, and absent lineage use the same reconciler
- replay yields the identical ledger
- a second reconciliation pass makes no changes
- re-kick preserves source IDs, criterion assignments, chunk IDs, and hashes
- ambiguous matches fail closed
- persistence failure leaves neither a partial result nor orphan/duplicate ledger rows
- no raw manuscript or recommendation prose is stored in the ledger
