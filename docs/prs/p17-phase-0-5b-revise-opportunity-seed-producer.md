# P17 — Add Phase 0.5B Revise Opportunity Seed Producer

Status: planned implementation PR  
Depends on: #876, #877, #878, P14, P15  
Scope: Revise Opportunity Seed producer only

## Purpose

Implement Phase 0.5B as a governed producer of `revise_opportunity_seed_v1`.

Phase 0.5B performs revision-opportunity discovery and candidate drafting under proven Phase 0 authority. It does not create author-facing Revise Queue cards directly.

## Authority Registry

This PR must comply with:

`docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`

## Required inputs

- `phase0_authority_proof_v1`
- manuscript ingestion/source text
- chunk/routing manifest
- manuscript version id
- loaded authority paths/checksums from Phase 0 proof
- 13 Story Criteria canon
- WAVE / long-form readiness canon where eligible
- dialogue/speech/POV protection canon
- Gate 15 / long-form governance where eligible
- Revise Queue candidate-prose contract

## Required output

- `revise_opportunity_seed_v1`

## Required opportunity fields

Each opportunity must include:

```text
opportunity_id
criterion_key
canon_basis[]
authority_path_basis[]
severity: MUST | SHOULD | COULD
scope
location_label
location_anchor
original_passage
operation_type
symptom
cause
reader_effect
evidence
fix_direction
mistake_proofing
candidate_a
candidate_b
candidate_c
author_decision_status = pending
validation_status = unvalidated
```

## A/B/C rule

A/B/C must be candidate revision options, not repeated diagnostic text.

- A = Recommended Repair
- B = Balanced Revision
- C = Bolder Rendering Shift

Forbidden A/B/C content:

- repeated problem statement
- meta-advice only
- empty string
- internal pipeline token
- evidence anchor as replacement prose
- generic “improve/expand/show more” instruction without bounded candidate action
- dialogue/speech change that violates protection rules
- author voice rewrite without canon-supported reason

## Non-goals

This PR must not:

- create author-facing Revise Queue cards
- apply revisions to manuscript text
- skip Revise Admission
- skip candidate validation
- skip Phase 2 or Phase 3 evaluation
- treat revision opportunities as proven without evidence verification

## Required behavior

- Phase 0.5B must block without valid or degraded-with-proof `phase0_authority_proof_v1`.
- Seed must record authority proof id and authority checksums.
- Each opportunity must carry diagnostic six: evidence, symptom, cause, fix direction, reader effect, mistake-proofing.
- Each opportunity must include A/B/C candidate fields.
- Unsafe/incomplete opportunities must remain unvalidated and route later to Needs Targeting or suppression.

## Acceptance criteria

- `revise_opportunity_seed_v1` persists successfully under authority proof.
- Missing authority proof blocks generation.
- Seed records `phase0_authority_proof_id`.
- Opportunities include diagnostic six and A/B/C candidates.
- Seed is not author-facing.
- Revise Admission remains required.

## Required tests

- Blocks without `phase0_authority_proof_v1`.
- Produces schema-valid seed with authority proof id.
- Rejects opportunity without location anchor.
- Rejects opportunity without original passage.
- Rejects candidate A/B/C that repeat the problem statement.
- Rejects internal evidence tokens as candidate prose.
- Does not produce `revise_queue_package_v1`.

## Done sentence

Phase 0.5B now produces a governed, authority-bound Revise Opportunity Seed for downstream Revise Admission and candidate validation.
