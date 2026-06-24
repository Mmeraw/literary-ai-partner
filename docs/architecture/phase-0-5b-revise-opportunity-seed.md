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
docs/benchmarks/froggin-noggin-dream.md
docs/benchmarks/froggin-noggin-dream-v2-governed-ledger-addendum.md
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
- `schema_version`
- `job_id`
- `manuscript_id`
- `manuscript_version_id`
- `loaded_authority_paths[]`
- `missing_authority_paths[]`
- `authority_checksums{}`
- `warmup_manifest_path`
- `warmup_manifest_checksum`
- `loaded_at`
- `status`: `valid | degraded | blocked`
- `blocking_reason_codes[]`
- `is_resume_safe`

## Missing authority behavior

If Phase 0 authority proof is unavailable, incomplete, stale, or contradictory, Phase 0.5A/0.5B must not silently proceed as if canon was loaded.

Allowed outcomes:

- block with explicit missing-authority reasons;
- proceed in degraded mode only if the artifact records which canon sources were unavailable and why proceeding is safe;
- retry warmup/canon loading before seed generation.

## Doctrine

The Revise Opportunity Seed performs discovery and editorial drafting work. The production system still performs validation, admission control, rendering safety, author workflow, persistence, and re-evaluation.

No downstream phase may ignore `revise_opportunity_seed_v1` when it exists.

No seeded revision opportunity may render author-facing unless it passes Revise Admission and candidate-prose validation.

A seeded opportunity is not automatically true, actionable, or safe merely because it exists.

## Required artifact

`revise_opportunity_seed_v1`

Required top-level fields:

- `artifact_id`
- `artifact_type = "revise_opportunity_seed_v1"`
- `schema_version`
- `job_id`
- `manuscript_id`
- `manuscript_version_id`
- `source = "phase_0_5b"`
- `created_by`
- `created_at`
- `input_artifact_ids`
- `authority_artifact_ids`
- `canon_sources_loaded[]`
- `canon_sources_missing[]`
- `loaded_authority_paths[]`
- `authority_checksums{}`
- `phase0_warmup_proof_id`
- `phase0_authority_proof_id`
- `opportunities[]`
- `status`
- `is_resume_safe`

## Required opportunity fields

Each opportunity must include:

- `opportunity_id`
- `criterion_key`
- `canon_basis[]`
- `authority_path_basis[]`
- `severity`: `MUST | SHOULD | COULD`
- `scope`: `manuscript | act | chapter | scene | paragraph | sentence | phrase`
- `location_label`
- `location_anchor`
- `original_passage`
- `operation_type`
- `symptom`
- `cause`
- `reader_effect`
- `evidence`
- `fix_direction`
- `mistake_proofing`
- `candidate_a`
- `candidate_b`
- `candidate_c`
- `author_decision_status = "pending"`
- `validation_status = "unvalidated"`

## A/B/C roles

A/B/C are not labels for advice. They are candidate revision options.

- A — Recommended Repair: best default fix, least disruptive, preserves authorial intent.
- B — Balanced Revision: same repair goal with different rhythm, emphasis, or pacing.
- C — Bolder Rendering Shift: stronger interpretive move while still respecting manuscript logic.

Each candidate must be usable replacement prose or a clearly bounded surgical instruction when direct replacement prose is impossible.

Forbidden A/B/C content:

- repeated problem statement
- meta-advice only
- empty strings
- internal pipeline tokens
- evidence anchors as replacement prose
- generic “should/could improve” commentary without candidate text
- changes that violate dialogue/speech protection rules
- changes that rewrite author voice without a canon-supported reason

## Diagnostic Six

Each opportunity must include the diagnostic six used by the Revise Queue card:

1. Evidence — what manuscript text triggered the opportunity.
2. Symptom — what appears weak, missing, confusing, repetitive, unresolved, or under-leveraged.
3. Cause — why the weakness exists at craft/story level.
4. Fix Direction — what the revision must accomplish.
5. Reader Effect — what improves for the reader if repaired.
6. Mistake-proofing — what the repair must not damage.

## Downstream gates

`revise_opportunity_seed_v1` must pass through:

1. `phase0_authority_proof_v1`
2. `revise_seed_schema_validation_v1`
3. `revise_seed_authority_validation_v1`
4. `revise_seed_evidence_verification_v1`
5. `revise_admission_result_v1`
6. `revise_candidate_validation_v1`
7. `revise_queue_package_v1`

Only `revise_queue_package_v1` is author-facing.

## Resume/checkpoint behavior

Phase 0.5B must persist `revise_opportunity_seed_v1` before any Revise admission or rendering work begins.

If Revise admission fails, the job must resume from `revise_opportunity_seed_v1` rather than regenerating opportunities.

If candidate validation fails for individual opportunities, invalid opportunities must route to `needs_targeting` or `suppressed_invalid_candidate`, not render as Ready cards.

If canon authority validation fails, the artifact may be stored for audit but must not be marked resume-safe for author-facing Revise.

## Relationship to evaluation phases

Phase 0.5B does not eliminate Phase 1A, Phase 2, Phase 3, Pass 3A, or WAVE.

It reduces blind discovery burden.

- Phase 1A verifies seeds against manuscript evidence.
- Pass 3A normalizes verified story facts.
- Phase 2 evaluates craft using verified context.
- Phase 3 synthesizes the evaluation report.
- WAVE performs long-form readiness and continuity analysis.
- Revise Admission determines whether seeded opportunities can become author-facing cards.

## Non-goals

This PR must not:

- apply patches to manuscripts
- create destructive writes
- replace evaluation scoring
- bypass semantic gates
- bypass candidate prose validation
- make Phase 0.5B opportunities automatically author-facing
- re-enable the old ten-layer author approval click-through flow
- allow best-guess seeds without Phase 0 canon/governance proof
- create a divergent warmup loader or second authority registry

## Acceptance criteria

- `revise_opportunity_seed_v1` is documented as a durable Phase 0.5B artifact.
- Phase 0.5A/0.5B are documented as canon-first and warmup-first.
- Exact authority paths are named.
- `phase0_authority_proof_v1` is required before seed generation.
- Missing authority behavior is explicit.
- Required opportunity fields are defined.
- Diagnostic Six are defined.
- A/B/C candidate roles are defined.
- Downstream gates are named.
- Resume behavior is explicit.
- The PR remains documentation/scaffold only until implementation and tests are added.
