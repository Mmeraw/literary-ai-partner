# Phase 0 Warmup Benchmark Manifest

Status: canonical warmup packet v1  
Audience: Phase 0, SEED generation, Phase 1A, Story Layer Quality Gate, Review Gate  
Runtime role: compact manifest only. Do not mine GitHub PR history during evaluation runtime.

## Purpose

Phase 0 must load a compact, deterministic set of benchmark and governance references before SEED generation and Phase 1A work. The system must not search historical PRs live during an evaluation. PR history is raw ore. This manifest is the runtime map.

## Runtime loading rule

Load only the current canonical files listed here, by path and version/hash where available. Do not load hundreds of PRs, review comments, old branch notes, or stale implementation discussions during evaluation runtime.

## Required Phase 0 warmup packet

These files form the compact Phase 0 control packet:

```text
docs/phase-0-warmup/PHASE_0_WARMUP_BENCHMARK_MANIFEST.md
docs/phase-0-warmup/WHAT_NOT_TO_DO.md
docs/phase-0-warmup/STORY_LEDGER_LAYER_FAILURE_MODES.md
docs/phase-0-warmup/REVISIONGRADE_FAIL_CLOSED_RULES.md
docs/phase-0-warmup/SIPOC_INPUT_OUTPUT_QUALITY_GATES.md
docs/phase-0-warmup/SEED_AND_PHASE_1A_GOVERNANCE.md
```

## Core long-form benchmark canon

```text
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
docs/benchmarks/README.md
docs/benchmarks/templates/dream-longform-layered-template.md
docs/governance/DREAM_OUTPUT_LONG_FORM_SPEC.md
```

## Manuscript benchmark sets

```text
docs/benchmarks/cartel-babies-dream.md
docs/benchmarks/cartel-babies-dream-v2-governed-ledger-addendum.md

docs/benchmarks/froggin-noggin-dream.md
docs/benchmarks/froggin-noggin-dream-v2-governed-ledger-addendum.md

docs/benchmarks/let-the-river-decide-dream.md
docs/benchmarks/let-the-river-decide-dream-v2-governed-ledger-addendum.md
```

## Public-domain calibration benchmarks

```text
docs/benchmarks/public-domain/dracula-dream-calibration.md
docs/benchmarks/public-domain/great-expectations-dream-calibration.md
docs/benchmarks/public-domain/pride-and-prejudice-dream-calibration.md
docs/benchmarks/public-domain/the-awakening-dream-calibration.md
docs/benchmarks/public-domain/the-awakening-dream-calibration-v2-governed-ledger-addendum.md
```

## Story Ledger benchmark answer keys

These files define benchmark-quality nine-layer Story Ledger targets and should be used for SEED quality, Phase 1A Story Ledger extraction expectations, fit-gap reporting, and regression targets.

```text
docs/benchmarks/story-ledger/README.md

docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_9_LAYER_BENCHMARK_CARTEL_BABIES.md
docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_9_LAYER_BENCHMARK_FROGGIN_NOGGIN.md
docs/benchmarks/story-ledger/IDEAL_STORY_LEDGER_9_LAYER_BENCHMARK_LET_THE_RIVER_DECIDE.md

docs/benchmarks/story-ledger/FROGGIN_NOGGIN_9_LAYER_OPTIMIZATION_ADDENDUM.md
docs/benchmarks/story-ledger/LET_THE_RIVER_DECIDE_9_LAYER_OPTIMIZATION_ADDENDUM.md
```

## Additional benchmark-related references

```text
docs/benchmarks/ancient-bloodlines-longform-layered-template.md
docs/benchmarks/ancient-bloodlines-longform-layered.md
docs/benchmarks/ancient-bloodlines-shortform-model.md
docs/benchmarks/github-ancient-bloodlines-gold-standard-brief.md
docs/benchmarks/BENCHMARK-CHARTER.md
```

## Runtime hierarchy

```text
Phase 0 warmup packet
  ↓
story_map_seed_v1 + evaluation_seed_v1
  ↓
Seed Completeness Gate
  ↓
Phase 1A Story Ledger extraction
  ↓
Story Layer Quality Gate
  ↓
ledger_quality_report_v1
  ↓
Review Gate
  ↓
accepted_story_ledger_v1
  ↓
Phase 2 evaluation
```

## Authority hierarchy

```text
Benchmarks define target quality.
SEED proposes baseline scaffolds.
Phase 1A verifies against manuscript evidence.
Story Layer Quality Gate classifies layer health.
Author Review Gate authorizes accepted_story_ledger_v1.
accepted_story_ledger_v1 governs Phase 2.
```

## Prohibited runtime behavior

- Do not search GitHub PR history during evaluation runtime.
- Do not load stale PR descriptions as live canon.
- Do not load draft/do-not-merge PRs as authority.
- Do not allow old PR doctrine to override current warmup files.
- Do not let benchmark text replace manuscript evidence.
- Do not let SEED become final truth.

## Required runtime behavior

- Load compact warmup files only.
- Use benchmark files as quality targets, not manuscript evidence.
- Record missing benchmark-required elements as fit-gaps.
- Suppress/degrade/block substandard Story Ledger layers before Review Gate.
- Use deterministic guardrails where possible.
- Keep historical PR lessons distilled into canonical docs and tests.
