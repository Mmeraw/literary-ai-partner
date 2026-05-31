# P15 — Persist Phase 0 Authority Proof Artifact

Status: planned implementation PR  
Depends on: #876, #877, #878, P14  
Scope: authority proof producer and persistence

## Purpose

Create the runtime producer for `phase0_authority_proof_v1`.

The Phase 0 Authority Registry exists as doctrine. This PR makes the runtime load it, resolve authority paths, checksum sources, and persist proof before Phase 0.5A or Phase 0.5B may run.

## Authority Registry

This PR must comply with:

`docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`

If there is ambiguity about canon, warmup, benchmark authority, WAVE, the 13 Story Criteria, Gate 15, dialogue/speech protection, Story Ledger standards, Revise Queue doctrine, or fail-closed behavior, this registry is the first source of truth.

## Required artifact

`phase0_authority_proof_v1`

Required fields:

```text
artifact_id
artifact_type = phase0_authority_proof_v1
schema_version
job_id
manuscript_id
manuscript_version_id
registry_path
registry_checksum
loaded_authority_paths[]
missing_authority_paths[]
authority_checksums{}
loaded_at
status: valid | degraded | blocked
blocking_reason_codes[]
is_resume_safe
```

## Runtime behavior

1. Load `docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md`.
2. Resolve required authority paths.
3. Read each file.
4. Compute checksums.
5. Record missing/unreadable authority paths.
6. Classify proof as `valid`, `degraded`, or `blocked`.
7. Persist `phase0_authority_proof_v1`.
8. Mark `is_resume_safe=true` only if proof is valid or degraded-with-recorded reasons.

## Missing authority behavior

Allowed outcomes:

- `valid`: all required critical authority paths loaded and checksummed.
- `degraded`: non-critical authority path missing, reason recorded, and safe continuation justified.
- `blocked`: critical authority missing/unreadable/stale, seed generation must not run.

Forbidden outcome:

- generating Phase 0.5 seeds from manuscript text alone while pretending canon was loaded.

## Non-sprawl guardrails

- Do not create a second warmup/canon loader.
- Do not hardcode a divergent authority path list outside the registry/loader.
- Do not mine PR history or draft comments at runtime.
- Do not let authority proof become final story truth.
- Do not bypass checklist enforcer.

## Acceptance criteria

- Runtime can produce and persist `phase0_authority_proof_v1`.
- Artifact records registry checksum and per-authority checksums.
- Missing paths are recorded, not swallowed.
- Valid/degraded/blocked status is deterministic.
- Phase 0.5A/0.5B guards can consume the persisted proof.

## Required tests

- Produces valid proof when registry and all critical paths resolve.
- Produces degraded proof only with structured missing-authority reasons.
- Produces blocked proof when critical authority is missing.
- Refuses `is_resume_safe=true` for blocked proof.
- Checksum changes are visible in artifact output.

## Done sentence

Phase 0 now produces a durable authority proof artifact that Phase 0.5A and Phase 0.5B must consume before seed generation.
