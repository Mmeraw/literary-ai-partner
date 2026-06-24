# Phase 0.5B — Revise Opportunity Seed Contract

## Purpose

Phase 0.5B introduces `revise_opportunity_seed_v1`: a pre-created revision opportunity ledger that feeds the Revise system without requiring the production pipeline to discover every revision opportunity from scratch.

This artifact is separate from Phase 0.5A Story Map Seed.

- Phase 0.5A answers: what does the manuscript contain?
- Phase 0.5B answers: what targeted revision opportunities appear to exist, where are they, why do they matter, and what candidate repairs can the author choose?

## Non-negotiable canon-first rule

Phase 0.5A and Phase 0.5B must run only after Phase 0 governance warmup is loaded and proven.

The seed artifacts must be created against RevisionGrade canon, governance, warmup materials, the DREAM long-form multi-layer template, and the current runtime benchmark authority map. They are not best-guess editorial passes.

Forbidden outcome:

- generating story-map or revision-opportunity seeds from manuscript text alone while pretending RevisionGrade canon governed the result.

## Exact Phase 0 authority registry

Phase 0.5A and Phase 0.5B must not rely on vague phrases like “warmup,” “benchmark docs,” or “canon.” They must load, record, and checksum exact authority paths before seed generation.

### A. Required compact Phase 0 warmup packet

```text
docs/phase-0-warmup/PHASE_0_WARMUP_BENCHMARK_MANIFEST.md
docs/phase-0-warmup/WHAT_NOT_TO_DO.md
docs/phase-0-warmup/STORY_LEDGER_LAYER_FAILURE_MODES.md
docs/phase-0-warmup/REVISIONGRADE_FAIL_CLOSED_RULES.md
docs/phase-0-warmup/SIPOC_INPUT_OUTPUT_QUALITY_GATES.md
docs/phase-0-warmup/SEED_AND_PHASE_1A_GOVERNANCE.md
```

### B. Core long-form benchmark canon

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
docs/benchmarks/README.md
docs/benchmarks/templates/dream-longform-layered-template.md
docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md
```

### C. Native manuscript benchmarks, public calibration benchmarks, and Story Ledger answer keys

The canonical runtime list lives in:

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
```

The map includes native long-form multi-layer benchmarks, public-domain calibration benchmarks, and Story Ledger benchmark answer keys. This indirection prevents stale path drift when new benchmark files are added.

### D. Registered canon and governance files required for 0.5A/0.5B

These paths must be treated as authority inputs when present:

```text
docs/canon/intake/_md/VOLUME II — STORY EVALUATION CRITERIA & ANALYTICAL FRAMEWORK (V2.0).md
docs/canon/registered/volumes/VOLUME-I-WAVE-REVISION-GUIDE-CANON.md
docs/canon/intake/_md/VOLUME I WAVE REVISION GUIDE CANON V22.md
docs/dialogue-speech-pov-canon-enforcement.md
docs/canon/intake/_md/GATE_15_2_PR1_CANON_AND_SCHEMA_SPEC.md.md
docs/canon/intake/_md/docs-canon-GENRE_INTENT_EVALUATION_CANON.md.md
docs/canon/intake/_md/RevisionGrade System Overview  - The Governed Narrative Evaluation and Revision Platform.md
```

### E. Runtime scripts/loaders that must be aligned

Implementation must wire Phase 0.5A/0.5B to the same compact manifest and runtime benchmark authority map logic instead of ad hoc path lists. If a canonical warmup loader already exists, use it; do not create a second divergent loader.

Required implementation behavior:

```text
1. Load Phase 0 manifest.
2. Load docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md.
3. Resolve every authority path from the manifest/registry/map.
4. Hash/checksum each loaded authority file.
5. Persist phase0_authority_proof_v1.
6. Pass phase0_authority_proof_v1 into Phase 0.5A and Phase 0.5B.
7. Refuse best-guess seed generation if required authority proof is missing.
```

## Required authority proof artifact

Before `story_map_seed_v1` or `revise_opportunity_seed_v1` is created, the pipeline must persist:

`phase0_authority_proof_v1`

Required fields include:

- `artifact_id`
- `artifact_type = "phase0_authority_proof_v1"`
- `registry_path`
- `registry_checksum`
- `runtime_benchmark_authority_map_path`
- `runtime_benchmark_authority_map_checksum`
- `loaded_authority_paths[]`
- `missing_authority_paths[]`
- `authority_checksums{}`
- `status`
- `blocking_reason_codes[]`

## Revise Queue and Revise Workbench use

Revise Queue and Revise Workbench must use benchmark authority for:

- opportunity shape;
- six-part criterion opportunity completeness;
- layer-completeness expectations;
- repair option quality;
- genre/form-aware failure modes;
- WAVE-aligned revision priority ordering.

They must not use benchmark authority for:

- inventing manuscript facts;
- overriding the accepted Story Ledger;
- importing characters, objects, symbols, endings, or world rules from benchmark works;
- replacing manuscript evidence.

## Output contract

`revise_opportunity_seed_v1` must record the authority basis for each opportunity when applicable:

```text
phase0_authority_proof_id
authority_path_basis[]
runtime_benchmark_authority_map_path
canon_sources_missing[]
benchmark_fit_gap_notes[]
```

## Fail-closed rule

If the authority proof is missing, degraded beyond acceptable threshold, or lacks the runtime benchmark authority map, Phase 0.5B must either block or mark the seed degraded with explicit reason codes. It must not silently produce Revise opportunities from manuscript text alone.
