# SIPOC Input / Output Quality Gates

Status: canonical warmup packet v1  
Purpose: map each major RevisionGrade process step to required suppliers, inputs, process outputs, customers, and quality gates.

## Core principle

Every phase must declare its minimum usable input and its minimum acceptable output. If a phase cannot produce the required output, it must fail closed, create a fit-gap/quality report, or degrade with proof.

Each phase should complete as soon as its acceptance criteria are satisfied. The maximum time is a safety budget, not a required delay.

---

# SIPOC summary

| Phase / Process | Supplier | Input | Process | Output | Customer | SLA |
|---|---|---|---|---|---|---|
| Phase 0 Authority Binding | Precomputed `phase0_calibration_baseline_v1` | Certified calibration baseline (Dream/Gold/Canon/Fail-closed) | Load baseline → verify checksum → confirm authority → select route | `phase0_authority_proof_v1` | Phase 0.5A, Phase 0.5B | 12–15s target, 40s maximum |
| Phase 0.5A Story / Evaluation Seeds | Phase 0 authority proof + manuscript | `phase0_authority_proof_v1` + calibration baseline + manuscript text | Generate provisional manuscript scaffolds | `story_map_seed_v1` + `evaluation_seed_v1` | Seed Completeness Gate | 45–75s short-form target; 90–120s Long-Form Multi-Layer target; 150s maximum |
| Seed Completeness Gate | Phase 0.5A | Two seed artifacts | Validate completeness | `seed_fit_gap_report_v1` | Enhanced Ledger or regeneration | 5–10s target, 20s maximum |
| Phase 0.5A Enhanced Story Ledger | Seeds + manuscript | `story_map_seed_v1` + `evaluation_seed_v1` + full manuscript | Generate 10-layer deep story ledger | `full_context_story_ledger_v1` | Phase 1A | 90–150s target, 180s maximum |
| Phase 1A | Manuscript + seeds + ledger | Text + seed baselines + accepted ledger | Extract nine Story Ledger layers | `pass1a_story_layer_v1` | Story Layer Quality Gate | — |
| Story Layer Quality Gate | Phase 1A | Generated layers + benchmarks | Validate per-layer quality | `ledger_quality_report_v1` | Review Gate | — |
| Review Gate | Author + quality report | Valid/degraded/suppressed layers | Author review/approval | `accepted_story_ledger_v1` | Phase 2 | — |
| Phase 2 | Accepted ledger | Accepted story authority + criteria | Craft evaluation | phase2/evaluation artifacts | Report / Revise handoff | — |
| Revision Handoff | Evaluation | Anchored findings | Normalize operations | `revision_opportunity_ledger_v1` | Revise Queue / TrustedPath | — |
| Revise Queue | Revision ledger | Anchored operations | Author-controlled decisions | `revision_ledger_decisions` | Manuscript repair | — |

---

# Phase 0 — Authority Binding

## Architecture

Phase 0 is a **deterministic authority-binding stage**. It does NOT re-read or re-summarize Dream/Gold/Canon docs per job. Instead, it loads a **precomputed certified calibration baseline** (`phase0_calibration_baseline_v1`) that was generated offline/admin-time from static governance documents.

Runtime Phase 0 performs:
1. Load `phase0_calibration_baseline_v1` (precomputed)
2. Verify version/checksum integrity
3. Confirm required authority paths are present
4. Select route/scope based on manuscript metadata
5. Persist `phase0_authority_proof_v1` linking to baseline version/checksum

**No LLM calls in Phase 0.** All document interpretation happens at build/admin time when the calibration baseline is generated.

## SLA / timing target

| Metric | Target | Maximum |
|---|---|---|
| Phase 0 completion (authority binding + route selection) | 12–15 seconds | 40 seconds |
| Manuscript minimum word count (submission gate) | 200 words | Enforced by `EVAL_MIN_MANUSCRIPT_WORDS` (default: 200) |

**Timing rule:** Phase 0 must move on as soon as authority binding, checksum verification, route selection, and persistence acceptance criteria are satisfied. The 40-second maximum is only a safety budget for checksum verification, route selection, artifact validation, and repository growth.

## Required inputs

- `phase0_calibration_baseline_v1` (precomputed, versioned, checksummed)
- Manuscript metadata (word count, structure)

## Required output

- `phase0_authority_proof_v1` containing:
  - Calibration baseline version/checksum linkage
  - Authority paths confirmed
  - Selected route: short-form / long-form / Long-Form Multi-Layer
  - Route rationale
  - No live PR mining

## Quality metrics

| Metric | Minimum |
|---|---|
| Calibration baseline loaded | yes |
| Baseline checksum verified | yes |
| Authority paths confirmed | yes |
| Route selected | yes |
| Phase 0 duration ≤ 40s | yes |

---

# Phase 0.5A — Story / Evaluation Seed Generation

**This is the first manuscript-understanding stage.** It uses the certified calibration baseline + manuscript to generate provisional scaffolds.

## Required inputs

- `phase0_authority_proof_v1` (from Phase 0)
- `phase0_calibration_baseline_v1` (precomputed)
- Manuscript text
- Word count / scope estimate
- Route selection from Phase 0

## Required outputs

```text
story_map_seed_v1
evaluation_seed_v1
```

## SLA / output targets

| Metric | Target | Maximum |
|---|---|---|
| Combined seed output | minimum 500 words | — |
| Short-form seed generation timing | 45–75 seconds | 150 seconds |
| Long-Form Multi-Layer seed generation timing | 90–120 seconds | 150 seconds |

**Timing rule:** seed generation must move on as soon as `story_map_seed_v1` and `evaluation_seed_v1` satisfy the seed acceptance criteria. The 150-second maximum is a safety budget, not a required delay.

## Quality metrics

| Metric | Minimum |
|---|---|
| story_map_seed_v1 exists | yes |
| evaluation_seed_v1 exists | yes |
| Combined seed output ≥ 500 words | yes |
| all 9 Story Ledger layer scaffolds present | yes |
| all candidate input collections present | yes |
| all 13 criteria scaffolded | yes |
| route selected | short / long / Long-Form Multi-Layer |
| final scores in seed | no |
| final verdict in seed | no |
| seed authority | seed_only |

---

# Seed Completeness Gate

## Required inputs

- story_map_seed_v1
- evaluation_seed_v1

## Required output

```text
seed_fit_gap_report_v1
```

## SLA / timing target

| Metric | Target | Maximum |
|---|---|---|
| Seed completeness validation | 5–10 seconds | 20 seconds |

**Timing rule:** the gate must proceed immediately once seed completeness has been validated and `seed_fit_gap_report_v1` has been persisted. The 20-second maximum is a safety budget for artifact read/write latency and validation overhead.

## Quality metrics

| Metric | Minimum |
|---|---|
| Missing required seed sections detected | yes |
| Fit-gap report persisted | yes |
| Phase 1A blocked on incomplete seed | yes |
| Error code on block | SEED_FIT_GAP_BLOCKED |

---

# Phase 0.5A — Enhanced Story Ledger (`full_context_story_ledger_v1`)

**This is a separate stage from Phase 0 seed generation.** It runs AFTER seeds are produced and generates the deep 10-layer story ledger from full manuscript context.

## SLA / timing target

| Metric | Target | Maximum |
|---|---|---|
| Phase 0.5A Enhanced Story Ledger completion | 90–150 seconds | 180 seconds |
| Output size | scope-dependent (typically 3,000–10,000 words for 5,000-word manuscript) | — |

**Timing rule:** Enhanced Story Ledger generation must move on as soon as `full_context_story_ledger_v1` satisfies acceptance criteria. The 180-second maximum is a safety budget, not a required delay.

**Note:** Phase 0.5A Enhanced Story Ledger timing does NOT count against the Phase 0 authority-binding budget. These are distinct pipeline stages with independent budgets.

## Required inputs

- `story_map_seed_v1`
- `evaluation_seed_v1`
- Manuscript text (full context)
- Chunk routing manifest

## Required output

```text
full_context_story_ledger_v1
```

## Quality metrics

| Metric | Minimum |
|---|---|
| 10 canonical layers present | yes |
| Layer structure valid | yes |
| Canonical hard facts populated | yes |
| Acceptance checks populated | yes |
| Source authority: full manuscript context | yes |

---

# Phase 1A Story Ledger extraction gate

## Required inputs

- Manuscript text.
- Complete story_map_seed_v1.
- Complete evaluation_seed_v1.
- Benchmark context.

## Required output

```text
pass1a_story_layer_v1
```

## Quality metrics

| Metric | Minimum |
|---|---|
| Story layer exists for each canonical layer | yes |
| Each claim has evidence anchor | yes |
| Seed claims resolved as confirmed/refined/rejected | yes |
| Rejected seed claims cannot propagate | yes |
| Ledger authority remains evidence-bound | yes |
