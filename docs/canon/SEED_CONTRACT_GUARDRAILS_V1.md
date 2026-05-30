# SEED_CONTRACT_GUARDRAILS_V1

## Status

Documentation/contract only. No runtime behavior changes in this contract slice.

## Scope boundary (PR 1)

This contract defines governance language and acceptance boundaries for seed artifacts.

This contract must **not** in itself:

- change Phase 2 routing;
- introduce seed-based authority in scoring or synthesis;
- add a database migration;
- alter Review Gate authority;
- rename or replace canonical governing artifacts.

## Governing authority mapping

The existing persisted governing artifact remains:

- `accepted_story_ledger_v1`

Doctrine label mapping:

- "Golden Record" is a doctrine phrase only and maps to `accepted_story_ledger_v1` in persisted/runtime authority paths.

No new runtime code term may be introduced as a replacement for `accepted_story_ledger_v1` without explicit contract amendment.

## Seed authority doctrine

Seed artifacts are non-governing scaffolds.

Control-flow rule:

1. Seed proposes.
2. Chunks verify.
3. Reducer normalizes.
4. Integrity gate validates.
5. Author review authorizes.
6. `accepted_story_ledger_v1` governs.

Hard rule:

- The seed may shape downstream work, but it may not authorize downstream truth.

## Seed artifact candidates

Allowed future artifact names in this seed stream:

- `story_seed_v1`
- `evaluation_seed_v1`

Both are explicitly non-governing while in seed authority state.

## Status semantics (must remain split)

### Artifact-level lifecycle state (seed document)

- `created`
- `superseded`
- `archived`
- `failed`

### Claim-level verification state (seed hypotheses)

- `proposed_unverified`
- `partially_confirmed`
- `confirmed_by_evidence`
- `drift_detected`
- `superseded_by_evidence`
- `invalidated`

Rationale: artifact lifecycle and claim verification are distinct; collapsing them destroys calibration and audit fidelity.

## ID policy

Allowed during seed coordination:

- temporary IDs such as `temp_seed_entity_id`

Forbidden before normalization + gate + review:

- final canon identifiers that imply governing truth.

## PR 1 acceptance criteria

- docs/contracts only;
- no runtime execution changes;
- no Phase 2 trust/routing changes;
- no seed claim used as canon;
- no replacement code term for `accepted_story_ledger_v1`;
- artifact state and claim state are explicit and separate.
