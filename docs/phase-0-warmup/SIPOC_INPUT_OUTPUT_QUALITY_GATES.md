# SIPOC Input / Output Quality Gates

Status: canonical warmup packet v1  
Purpose: map each major RevisionGrade process step to required suppliers, inputs, process outputs, customers, and quality gates.

## Core principle

Every phase must declare its minimum usable input and its minimum acceptable output. If a phase cannot produce the required output, it must fail closed, create a fit-gap/quality report, or degrade with proof.

---

# SIPOC summary

| Phase / Process | Supplier | Input | Process | Output | Customer | SLA |
|---|---|---|---|---|---|---|
| Phase 0 Authority Binding | Precomputed `phase0_calibration_baseline_v1` | Certified calibration baseline (Dream/Gold/Canon/Fail-closed) | Load baseline → verify checksum → confirm authority → select route | `phase0_authority_proof_v1` | Phase 0.5A, Phase 0.5B | 12–15s target, 20s hard limit |
| Phase 0.5A Story Seeds | Phase 0 authority proof + manuscript | `phase0_authority_proof_v1` + calibration baseline + manuscript text | Generate provisional manuscript scaffolds | `story_map_seed_v1` + `evaluation_seed_v1` | Seed Completeness Gate | scope-dependent |
| Seed Completeness Gate | Phase 0.5A | Two seed artifacts | Validate completeness | `seed_fit_gap_report_v1` | Enhanced Ledger or regeneration | — |
| Phase 0.5A Enhanced Ledger | Seeds + manuscript | `story_map_seed_v1` + `evaluation_seed_v1` + full manuscript | Generate 9-layer deep story ledger | `full_context_story_ledger_v1` | Phase 1A | scope-dependent, 180s hard limit |
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

| Metric | Target | Hard limit |
|---|---|---|
| Phase 0 completion (authority binding + route selection) | 12–15 seconds | 20 seconds |
| Manuscript minimum word count (submission gate) | 200 words | Enforced by `EVAL_MIN_MANUSCRIPT_WORDS` (default: 200) |

## Required inputs

- `phase0_calibration_baseline_v1` (precomputed, versioned, checksummed)
- Manuscript metadata (word count, structure)

## Required output

- `phase0_authority_proof_v1` containing:
  - Calibration baseline version/checksum linkage
  - Authority paths confirmed
  - Selected route: short-form / long-form / long-form multi-layer
  - Route rationale
  - No live PR mining

## Quality metrics

| Metric | Minimum |
|---|---|
| Calibration baseline loaded | yes |
| Baseline checksum verified | yes |
| Authority paths confirmed | yes |
| Route selected | yes |
| Phase 0 duration ≤ 20s | yes |

---

# Phase 0.5A — Story Seed Generation

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

| Metric | Target |
|---|---|
| Combined seed output | minimum 500 words |
| Seed generation timing | scope-dependent (separate from Phase 0 SLA) |

## Quality metrics

| Metric | Minimum |
|---|---|
| story_map_seed_v1 exists | yes |
| evaluation_seed_v1 exists | yes |
| Combined seed output ≥ 500 words | yes |
| all 9 Story Ledger layer scaffolds present | yes |
| all candidate input collections present | yes |
| all 13 criteria scaffolded | yes |
| route selected | short / long / long-multilayer |
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

## Quality metrics

| Metric | Minimum |
|---|---|
| Missing required seed sections detected | yes |
| Fit-gap report persisted | yes |
| Phase 1A blocked on incomplete seed | yes |
| Error code on block | SEED_FIT_GAP_BLOCKED |

---

# Phase 0.5A — Enhanced Ledger (`full_context_story_ledger_v1`)

**This is a separate stage from Phase 0 seed generation.** It runs AFTER seeds are produced and generates the deep 10-layer story ledger from full manuscript context.

## SLA / timing target

| Metric | Target | Hard limit |
|---|---|---|
| Phase 0.5A completion | scope-dependent | 180 seconds |
| Output size | scope-dependent (typically 3,000–10,000 words for 5,000-word manuscript) | — |

**Note:** Phase 0.5A timing does NOT count against the Phase 0 12–15s seed SLA. These are distinct pipeline stages with independent budgets.

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
| 9 canonical layers present | yes |
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
| 9 layer outputs attempted | yes |
| seed used as baseline | yes |
| manuscript evidence used to verify/correct/reject seed | yes |
| machine chunk labels shown to author | no |
| evidence anchors present | yes where claims are shown |
| benchmark-required governing entities checked | yes |

---

# Story Layer Quality Gate

## Required inputs

- pass1a_story_layer_v1
- benchmark targets
- layer validators

## Required output

```text
ledger_quality_report_v1
```

## Quality metrics

| Metric | Minimum |
|---|---|
| every visible layer classified | yes |
| failed_benchmark_minimum blocks approval | yes |
| dirty layer suppressed/degraded | yes |
| author-safe reason shown | yes |
| valid empty pronoun state allowed | yes |
| raw malformed layer rendered | no |

Allowed statuses:

```text
valid
degraded_with_caution
suppressed_insufficient_evidence
suppressed_conflicting_signals
failed_benchmark_minimum
```

---

# Review Gate quality gate

## Required inputs

- pass1a_story_layer_v1
- ledger_quality_report_v1
- author decisions / comments

## Required output

```text
accepted_story_ledger_v1
```

## Quality metrics

| Metric | Minimum |
|---|---|
| all visible layers reviewed | yes |
| invalid status vocabulary normalized/rejected | yes |
| comments required for correction/reject states | yes |
| failed layers excluded from approval | yes |
| accepted_story_ledger_v1 persisted | yes |

---

# Phase 2 quality gate

## Required inputs

- accepted_story_ledger_v1
- evaluation route
- criteria scaffolds
- manuscript evidence

## Required output

- Criterion evaluation artifacts.
- Evidence-backed craft diagnosis.
- No seed-as-authority leakage.

## Quality metrics

| Metric | Minimum |
|---|---|
| accepted_story_ledger_v1 present | yes |
| seed used as authority | no |
| all applicable criteria addressed | yes |
| short-form under 25k uses 13 story criteria only | yes |
| long-form 25k+ uses manuscript-scale logic | yes |
| long-form multilayer uses layered/canonical analysis | yes |
| unanchored diagnosis | no |

---

# Revision Opportunity Ledger gate

## Required inputs

- Evaluation findings.
- Accepted story authority.
- Evidence anchors.
- Six-part diagnostic per recommendation (symptom, cause, fix_direction, reader_effect, evidence, operation).

## Required output

```text
revision_opportunity_ledger_v1
```

## Quality metrics

| Metric | Minimum |
|---|---|
| every opportunity has anchor | yes |
| operation type locked | yes |
| candidate_text present when required | yes |
| forbidden meta-commentary absent | yes |
| no anchor = no opportunity | enforced |
| vague advice routed to Needs Targeting | yes |
| symptom populated (≥10 chars, not template text) | yes |
| cause populated (≥10 chars, craft mechanism) | yes |
| fix_direction populated (≥10 chars, actionable) | yes |
| reader_effect populated (≥10 chars, impact statement) | yes |
| rationale is evidence-based (not contaminated) | yes |
| revision_operation specified | yes |

## Kick-backward behavior

If a recommendation arrives from Pass 3 without complete diagnostic fields:

1. `symptom` missing → derive from mechanism/action via `buildSymptomFromContext()`
2. `cause` missing → derive from `mechanism` field if available; otherwise hold for regeneration
3. `fix_direction` missing → derive from `recommendation` field if actionable; otherwise hold
4. `reader_effect` missing → derive from `expected_impact` if present; otherwise hold
5. `revision_operation` missing → infer from action text via `inferLedgerRevisionOperation()`

If derivation fails → opportunity enters `needs_diagnostic_enrichment` status and is blocked until the upstream supplier (Pass 3) regenerates with explicit diagnostic fields.

## Contamination rejection

Any field matching template meta-phrases (e.g., "There is a clear editorial opportunity in...", "This passage would benefit from...") is treated as contaminated input and blocked. The system logs the contamination source for telemetry.

---

# Revise Queue / TrustedPath gate

## Required inputs

- revision_opportunity_ledger_v1
- operation labels
- author decision state

## Required outputs

```text
revision_ledger_decisions
```

## Quality metrics

| Metric | Minimum |
|---|---|
| queue consumes ledger-backed opportunities | yes |
| author can accept/reject/defer/customize | yes |
| TrustedPath applies only trusted Option A | yes |
| versioning/rollback path exists for auto-apply | required before auto-apply |
| Revise re-diagnoses manuscript independently | no |

---

# Quality score dimensions

Each gate should be measured against:

| Dimension | Meaning |
|---|---|
| Completeness | Required fields/sections/entities exist |
| Correctness | Claims match manuscript evidence |
| Authority | Artifact is allowed to govern downstream phase |
| Traceability | Evidence/source location exists |
| Display safety | Author sees clean human-readable output |
| Latency discipline | Runtime loads compact canon, not PR history |
| Fail-closed behavior | Missing/dirty output blocks, suppresses, degrades, or fit-gaps |

## Bottom line

SIPOC is not paperwork. It is the minimum-quality contract for every handoff. If an output does not meet its customer’s minimum input quality, the next phase must not start cleanly.
