# P16 — Add Phase 0.5A Story Map Seed Producer

Status: planned implementation PR  
Depends on: #876, #877, #878, P14, P15  
Scope: story-map seed producer only

## Purpose

Implement Phase 0.5A as a governed producer of `story_map_seed_v1` and `evaluation_seed_v1`.

Phase 0.5A performs story discovery and seed drafting under proven Phase 0 authority. It does not replace Phase 1A verification, Pass 3A normalization, Semantic Gate, Phase 2 scoring, Phase 3 synthesis, or WAVE.

## Authority Registry

This PR must comply with:

`docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`

## Required inputs

- `phase0_authority_proof_v1`
- manuscript ingestion/source text
- chunk/routing manifest
- manuscript version id
- loaded authority paths/checksums from Phase 0 proof

## Required outputs

- `story_map_seed_v1`
- `evaluation_seed_v1`

## Required `story_map_seed_v1` content

At minimum:

```text
artifact_id
artifact_type = story_map_seed_v1
schema_version
job_id
manuscript_id
manuscript_version_id
phase0_authority_proof_id
loaded_authority_paths[]
authority_checksums{}
canon_sources_missing[]
seed_status
is_resume_safe
candidate_entity_registry[]
candidate_alias_map[]
candidate_relationship_map[]
candidate_object_symbol_map[]
candidate_location_map[]
candidate_timeline_map[]
candidate_pov_map[]
candidate_pressure_map[]
candidate_open_loop_map[]
uncertainty_flags[]
```

## Required `evaluation_seed_v1` content

At minimum:

```text
artifact_id
artifact_type = evaluation_seed_v1
schema_version
job_id
manuscript_id
manuscript_version_id
phase0_authority_proof_id
likely_13_criteria_strengths[]
likely_13_criteria_risks[]
known_story_risks[]
known_evidence_targets[]
evaluation_focus_notes[]
uncertainty_flags[]
```

## Non-goals

This PR must not:

- treat the seed as verified story truth
- create `accepted_story_ledger_v1`
- skip Phase 1A verification
- skip Pass 3A normalization
- skip Semantic Gate
- score the manuscript
- write the final evaluation report
- create author-facing Revise Queue cards

## Required behavior

- Phase 0.5A must block without valid or degraded-with-proof `phase0_authority_proof_v1`.
- Seed artifacts must record authority proof and authority checksums.
- Seed artifacts must be marked candidate/provisional, not verified.
- Missing or uncertain story facts must be recorded as uncertainty, not invented.
- The seed must be resume-safe only if schema-valid, authority-bound, and semantically usable.

## Acceptance criteria

- `story_map_seed_v1` and `evaluation_seed_v1` persist successfully under authority proof.
- Missing authority proof blocks generation.
- Generated seeds record `phase0_authority_proof_id`.
- Generated seeds are candidate/provisional.
- Phase 1A can consume the seed for verification.

## Required tests

- Blocks without `phase0_authority_proof_v1`.
- Produces schema-valid seed artifacts with authority proof id.
- Records uncertainty instead of inventing unsupported facts.
- Does not produce accepted story context.
- Does not advance Phase 2 directly.

## Done sentence

Phase 0.5A now produces governed, authority-bound story and evaluation seed artifacts for downstream verification.
