# SIPOC Input / Output Quality Gates

Status: canonical warmup packet v1  
Purpose: map each major RevisionGrade process step to required suppliers, inputs, process outputs, customers, and quality gates.

## Core principle

Every phase must declare its minimum usable input and its minimum acceptable output. If a phase cannot produce the required output, it must fail closed, create a fit-gap/quality report, or degrade with proof.

---

# SIPOC summary

| Phase / Process | Supplier | Input | Process | Output | Customer |
|---|---|---|---|---|---|
| Phase 0 Warmup | Canon docs / benchmarks | Manifest + what-not-to-do + benchmark refs | Load compact doctrine | Warmup context | SEED generation |
| SEED | Warmup + manuscript metadata | Manuscript profile + benchmark targets | Build provisional scaffolds | story_map_seed_v1 + evaluation_seed_v1 | Phase 1A |
| Seed Completeness Gate | SEED | Two seed artifacts | Validate completeness | seed_fit_gap_report_v1 | Phase 1A or regeneration |
| Phase 1A | Manuscript + seeds | Text + seed baselines | Extract nine Story Ledger layers | pass1a_story_layer_v1 | Story Layer Quality Gate |
| Story Layer Quality Gate | Phase 1A | Generated layers + benchmarks | Validate per-layer quality | ledger_quality_report_v1 | Review Gate |
| Review Gate | Author + quality report | Valid/degraded/suppressed layers | Author review/approval | accepted_story_ledger_v1 | Phase 2 |
| Phase 2 | Accepted ledger | Accepted story authority + criteria | Craft evaluation | phase2/evaluation artifacts | Report / Revise handoff |
| Revision Handoff | Evaluation | Anchored findings | Normalize operations | revision_opportunity_ledger_v1 | Revise Queue / TrustedPath |
| Revise Queue | Revision ledger | Anchored operations | Author-controlled decisions | revision_ledger_decisions | Manuscript repair |

---

# Phase 0 Warmup quality gate

## Required inputs

- PHASE_0_WARMUP_BENCHMARK_MANIFEST.md
- WHAT_NOT_TO_DO.md
- STORY_LEDGER_LAYER_FAILURE_MODES.md
- REVISIONGRADE_FAIL_CLOSED_RULES.md
- SIPOC_INPUT_OUTPUT_QUALITY_GATES.md
- SEED_AND_PHASE_1A_GOVERNANCE.md
- Applicable benchmark docs

## Required output

- Compact warmup context.
- Selected benchmark references.
- Selected route: short-form, long-form, or long-form multi-layer where possible.
- No live PR mining.

## Quality metrics

| Metric | Minimum |
|---|---|
| Manifest resolved | yes |
| Required warmup docs available | yes |
| PR history loaded at runtime | no |
| Benchmark path list present | yes |
| Fail-closed doctrine loaded | yes |

---

# SEED quality gate

## Required inputs

- Manuscript metadata.
- Word count / scope estimate.
- Warmup context.
- Benchmark targets.

## Required outputs

```text
story_map_seed_v1
evaluation_seed_v1
```

## Quality metrics

| Metric | Minimum |
|---|---|
| story_map_seed_v1 exists | yes |
| evaluation_seed_v1 exists | yes |
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
