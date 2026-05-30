# SEED_ARTIFACT_CONTRACT_V1

## Purpose

Define canonical seed artifacts as provisional scaffolds that reduce cold-start drift but never become governing story authority.

## Canonical seed artifacts

- `story_seed_v1`
- `evaluation_seed_v1`

Both are non-governing and must remain `phase2StoryAuthority: false` in registry policy.

## Governing authority boundary

- Governing story-understanding authority remains `accepted_story_ledger_v1`.
- Seed artifacts may shape extraction/routing context but may not authorize downstream truth.
- Phase 2 and Phase 3 must not consume seed artifacts as authority substitutes.

## Status split (contract rule)

Seed contracts must keep two layers of status semantics:

### Artifact lifecycle state

- `created`
- `superseded`
- `archived`
- `failed`

### Claim verification state

- `proposed_unverified`
- `partially_confirmed`
- `confirmed_by_evidence`
- `drift_detected`
- `superseded_by_evidence`
- `invalidated`

## ID policy

Allowed for provisional coordination:

- temporary IDs such as `temp_seed_entity_id`

Forbidden before normalization + gate + review:

- final canon identifiers that imply governing identity.

## PR2 boundary

This contract layer registers schemas and artifact metadata only.

It does not:

- change runtime route logic;
- alter Review Gate;
- alter Approval Normalizer;
- introduce seed-to-authority trust path.
