# Phase 0 Warmup Benchmark Manifest

Status: canonical warmup packet v1.1  
Audience: Phase 0, SEED generation, Phase 0.5A, Phase 0.5B, Phase 1A, Story Layer Quality Gate, Review Gate, Pass 3, WAVE, Revise Queue, Revise Workbench  
Runtime role: compact manifest only. Do not mine GitHub PR history during evaluation runtime.

## Purpose

Phase 0 must load a compact, deterministic set of benchmark and governance references before SEED generation and Phase 1A work. The system must not search historical PRs live during an evaluation. PR history is raw ore. This manifest is the runtime map.

## Runtime loading rule

Load only the current canonical files listed here, plus `docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md`. Do not load hundreds of PRs, review comments, old branch notes, or stale implementation discussions during evaluation runtime.

## Required Phase 0 warmup packet

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
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
docs/benchmarks/DREAM_LONGFORM_BENCHMARK_INDEX.md
docs/benchmarks/README.md
docs/benchmarks/templates/dream-longform-layered-template.md
docs/governance/DREAM_OUTPUT_LONG_FORM_MULTI_LAYER_SPEC.md
```

## Manuscript benchmark sets

The canonical native benchmark list lives in:

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
```

This includes Return to the Source, MythOAmphibia, Cartel Babies, Let the River Decide, Froggin Noggin, and native specialty addenda.

## Public-domain calibration benchmarks

The canonical public-domain calibration list lives in:

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
```

This includes Dracula, Great Expectations, Pride and Prejudice, The Awakening, Wizard of Oz, Murder on the Links, and required addenda.

## Story Ledger benchmark answer keys

These files define benchmark-quality ten-layer Story Ledger targets and should be used for SEED quality, Phase 1A Story Ledger extraction expectations, fit-gap reporting, and regression targets. The canonical list lives in:

```text
docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md
```

Note: The template (`STORY_LEDGER_10_LAYER_TEMPLATE.md`) defines the blank structure that seeds MUST populate. The benchmark files are filled gold-standard examples showing what good output looks like. The template structure is compiled into the seed generator prompts at runtime via `lib/evaluation/seed/benchmarkContextBuilder.ts`.

## Retired benchmark references — not current warmup authority

Retired benchmark references must not be used as current Story Ledger benchmark gates. Current warmup authority is the runtime benchmark authority map, with `IDEAL_STORY_LEDGER_10_LAYER_BENCHMARK_CARTEL_BABIES.md` as the primary product exemplar when a single compact example is needed.

## Runtime hierarchy

```text
Phase 0 warmup packet
  ↓
Runtime Benchmark Authority Map
  ↓
story_map_seed_v1 + evaluation_seed_v1 + revise_opportunity_seed_v1
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
Phase 2 / Phase 3 / Pass 3 / WAVE / Revise Queue / Revise Workbench
```

## Authority hierarchy

```text
Benchmarks define target quality.
SEED proposes baseline scaffolds.
Phase 1A verifies against manuscript evidence.
Story Layer Quality Gate classifies layer health.
Author Review Gate authorizes accepted_story_ledger_v1.
accepted_story_ledger_v1 governs evaluation and revise surfaces.
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
- Load `docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md` as the current benchmark path authority.
- Use benchmark files as quality targets, not manuscript evidence.
- Record missing benchmark-required elements as fit-gaps.
- Suppress/degrade/block substandard Story Ledger layers before Review Gate.
- Use deterministic guardrails where possible.
- Keep historical PR lessons distilled into canonical docs and tests.
