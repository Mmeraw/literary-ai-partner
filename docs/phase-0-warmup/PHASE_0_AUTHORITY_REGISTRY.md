# Phase 0 Authority Registry

Status: canonical authority registry v1.1  
Audience: Phase 0, Phase 0.5A, Phase 0.5B, Phase 1A, Pass 3A, Semantic Gate, Phase 2, Phase 3, WAVE, Revise Admission, Revise Queue, Revise Workbench  
Runtime role: exact authority map for warmup/canon/governance/benchmark loading. Do not mine GitHub PR history during evaluation runtime.

## Purpose

This registry defines the exact repository paths that constitute RevisionGrade Phase 0 authority.

Phase 0.5A and Phase 0.5B must not use vague references such as “warmup material,” “canon,” “benchmarks,” “calibration docs,” or “governance docs” without resolving them to this registry, `docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md`, or a successor version.

The registry exists so seeded artifacts are not best-guess editorial outputs. They are governed outputs produced after loading the current canonical authority set.

## Runtime rule

The runtime must:

1. Load this registry.
2. Load `docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md`.
3. Resolve every required path.
4. Hash/checksum each loaded authority file.
5. Persist `phase0_authority_proof_v1`.
6. Pass `phase0_authority_proof_v1` into Phase 0.5A and Phase 0.5B.
7. Block or degrade seed generation if required authority is missing.

## Required artifact produced from this registry

`phase0_authority_proof_v1`

Required fields:

- `artifact_id`
- `artifact_type = "phase0_authority_proof_v1"`
- `schema_version`
- `job_id`
- `manuscript_id`
- `manuscript_version_id`
- `registry_path = "docs/phase-0-warmup/PHASE_0_AUTHORITY_REGISTRY.md"`
- `registry_checksum`
- `runtime_benchmark_authority_map_path = "docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md"`
- `runtime_benchmark_authority_map_checksum`
- `loaded_authority_paths[]`
- `missing_authority_paths[]`
- `authority_checksums{}`
- `loaded_at`
- `status`: `valid | degraded | blocked`
- `blocking_reason_codes[]`
- `is_resume_safe`

## Authority categories

### A. Compact Phase 0 warmup packet — required

```text
docs/phase-0-warmup/PHASE_0_WARMUP_BENCHMARK_MANIFEST.md
docs/phase-0-warmup/WHAT_NOT_TO_DO.md
docs/phase-0-warmup/STORY_LEDGER_LAYER_FAILURE_MODES.md
docs/phase-0-warmup/REVISIONGRADE_FAIL_CLOSED_RULES.md
docs/phase-0-warmup/SIPOC_INPUT_OUTPUT_QUALITY_GATES.md
docs/phase-0-warmup/SEED_AND_PHASE_1A_GOVERNANCE.md
```

### B. Core long-form benchmark canon — required for long-form runs

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
docs/benchmarks/README.md
docs/benchmarks/templates/dream-longform-layered-template.md
docs/governance/DREAM_OUTPUT_LONG_FORM_MULTI_LAYER_SPEC.md
```

### C. Native manuscript benchmarks, public calibration benchmarks, and Story Ledger answer keys

The canonical runtime list lives in:

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
```

This indirection prevents stale path drift when new native or public calibration benchmarks are added.

### D. Registered canon and governance — required for 0.5A/0.5B authority grounding

```text
docs/canon/intake/_md/VOLUME II — STORY EVALUATION CRITERIA & ANALYTICAL FRAMEWORK (V2.0).md
docs/canon/registered/volumes/VOLUME-I-WAVE-REVISION-GUIDE-CANON.md
docs/canon/intake/_md/VOLUME I WAVE REVISION GUIDE CANON V22.md
docs/dialogue-speech-pov-canon-enforcement.md
docs/canon/intake/_md/GATE_15_2_PR1_CANON_AND_SCHEMA_SPEC.md.md
docs/canon/intake/_md/docs-canon-GENRE_INTENT_EVALUATION_CANON.md.md
docs/canon/intake/_md/RevisionGrade System Overview  - The Governed Narrative Evaluation and Revision Platform.md
```

## Phase-specific use

### Phase 0

Phase 0 loads this registry, the runtime benchmark authority map, and required files, then produces `phase0_authority_proof_v1`.

### Phase 0.5A

Phase 0.5A must consume `phase0_authority_proof_v1` before producing `story_map_seed_v1` or `full_context_story_ledger_v1`.

`story_map_seed_v1` and `full_context_story_ledger_v1` must record:

- `phase0_authority_proof_id`
- `loaded_authority_paths[]`
- `authority_checksums{}`
- `runtime_benchmark_authority_map_path`
- `canon_sources_missing[]`
- `authority_path_basis[]` where applicable

### Phase 0.5B

Phase 0.5B must consume `phase0_authority_proof_v1` before producing `revise_opportunity_seed_v1`.

`revise_opportunity_seed_v1` must record:

- `phase0_authority_proof_id`
- `loaded_authority_paths[]`
- `authority_checksums{}`
- `runtime_benchmark_authority_map_path`
- `canon_sources_missing[]`
- `authority_path_basis[]` for each opportunity where applicable

### Pass 1 / Pass 2

Pass 1 and Pass 2 may use benchmark authority as calibration context only. Manuscript evidence remains primary.

### Pass 3A / Pass 3B

Pass 3A and Pass 3B must use the runtime benchmark authority map to enforce DREAM long-form multi-layer structure, governed ledgers, evidence distribution, cross-layer synthesis, and report completeness.

### Quality Gate / Semantic Gate

Gates must treat missing benchmark-required surfaces as completeness or fit-gap findings, not as manuscript facts.

### WAVE / Revise Queue / Revise Workbench

WAVE, Revise Queue, and Revise Workbench must use benchmark authority for opportunity shape, layer-completeness standards, and repair quality patterns, while never treating benchmark prose as evidence about a submitted manuscript.

## Missing authority behavior

If any required authority path is missing, unreadable, stale, contradictory, or fails checksum validation, the runtime must not silently continue.

Allowed outcomes:

1. `blocked` — stop before seed generation and return explicit missing-authority reasons.
2. `degraded` — proceed only if the missing authority is non-critical for the manuscript/evaluation mode and the reason is recorded.
3. `retry` — retry authority loading before seed generation.

Forbidden outcomes:

- generating `story_map_seed_v1` from manuscript text alone;
- generating `revise_opportunity_seed_v1` from manuscript text alone;
- treating old PR descriptions, branch notes, or draft comments as runtime canon;
- allowing benchmark text to replace manuscript evidence;
- allowing SEED to become final truth.

## Authority hierarchy

```text
Phase 0 Authority Registry
  ↓
Runtime Benchmark Authority Map
  ↓
phase0_authority_proof_v1
  ↓
story_map_seed_v1 + evaluation_seed_v1 + revise_opportunity_seed_v1
  ↓
Phase 1A seed verification against manuscript evidence
  ↓
Pass 3A verified story handoff
  ↓
Semantic Gate
  ↓
Phase 2 / Phase 3 / WAVE / Revise Admission / Revise Queue / Revise Workbench
```

## Runtime prohibition

Do not load hundreds of historical PRs, review comments, old branches, archive exports, or stale implementation discussions during evaluation runtime.

Runtime authority must be compact, current, path-specific, checksum-recorded, and auditable.
