# Phase 0.5B — Revise Opportunity Seed Contract

## Purpose

Phase 0.5B introduces `revise_opportunity_seed_v1`: a pre-created, expert/ChatGPT-authored revision opportunity ledger that feeds the Revise system without requiring the production pipeline to discover every revision opportunity from scratch.

This artifact is separate from Phase 0.5A Story Map Seed.

- Phase 0.5A answers: what does the manuscript contain?
- Phase 0.5B answers: what targeted revision opportunities appear to exist, where are they, why do they matter, and what candidate repairs can the author choose?

## Non-negotiable canon-first rule

Phase 0.5A and Phase 0.5B must run only after Phase 0 governance warmup is loaded and proven.

The seed artifacts must be created against RevisionGrade canon, governance, and warmup materials first. They are not best-guess editorial passes.

Forbidden outcome:

- generating story-map or revision-opportunity seeds from manuscript text alone while pretending RevisionGrade canon governed the result.

## Exact Phase 0 authority registry

Phase 0.5A and Phase 0.5B must not rely on a vague phrase like “warmup.” They must load, record, and checksum the exact authority paths below before seed generation.

### A. Required compact Phase 0 warmup packet

These files are the runtime warmup control packet and must be loaded first:

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
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
docs/benchmarks/README.md
docs/benchmarks/templates/dream-longform-layered-template.md
docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md
```

### C. Native manuscript benchmark sets

```text
docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md
docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md
docs/benchmarks/let-the-river-decide-dream-longform-multilayer-gold-standard.md
```

### D. Public-domain calibration benchmarks

```text
docs/benchmarks/public-domain/dracula-dream-calibration.md
docs/benchmarks/public-domain/great-expectations-dream-calibration.md
docs/benchmarks/public-domain/pride-and-prejudice-dream-calibration.md
docs/benchmarks/public-domain/the-awakening-dream-calibration.md
docs/benchmarks/public-domain/the-awakening-dream-calibration-v2-governed-ledger-addendum.md
```

### E. Story Ledger benchmark answer keys

```text
docs/benchmarks/story-ledger/README.md
docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md
docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_FROGGIN_NOGGIN.md
docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_LET_THE_RIVER_DECIDE.md
docs/benchmarks/story-ledger/FROGGIN_NOGGIN_10_LAYER_OPTIMIZATION_ADDENDUM.md
docs/benchmarks/story-ledger/LET_THE_RIVER_DECIDE_10_LAYER_OPTIMIZATION_ADDENDUM.md
```

### F. Retired benchmark references — not current Story Ledger authority

Retired benchmark references have been removed from the active benchmark set. Current seed / Phase 1A Story Ledger calibration must use the ten-layer Story Ledger files above, with `IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md` as the primary product exemplar when a single example is needed.

### G. Registered canon and governance files required for 0.5A/0.5B

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

### H. Runtime scripts/loaders that must be aligned

Implementation PRs after this scaffold must wire Phase 0.5A/0.5B to the same compact manifest logic instead of ad hoc path lists. If a canonical warmup loader already exists, use it; do not create a second divergent loader.

Required implementation behavior:

```text
1. Load Phase 0 manifest.
2. Resolve every authority path from the manifest/registry.
3. Hash/checksum each loaded authority file.
4. Persist phase0_authority_proof_v1.
5. Pass phase0_authority_proof_v1 into Phase 0.5A and Phase 0.5B.
6. Refuse best-guess seed generation if required authority proof is missing.
```

## Required authority proof artifact

Before `story_map_seed_v1` or `revise_opportunity_seed_v1` is created, the pipeline must persist:

`phase0_authority_proof_v1`

Required fields:

- `artifact_id`
- `artifact_type = "phase0_authority_proof_v1"`
