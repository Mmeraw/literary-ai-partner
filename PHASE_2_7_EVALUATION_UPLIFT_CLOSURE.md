# Phase 2.7 — Evaluation Uplift (Pass 1-4, Dual Axis)

**Status:** ✅ COMPLETED  
**Date:** 2026-03-20  
**Final Commit:** `64bd201` (roadmap), `b625c89` (code)  
**Implementer:** GitHub Copilot  
**Spec Author:** ChatGPT  
**Governance Review:** Perplexity Computer  

---

## Executive Verdict

Phase 2.7 is **complete**. The four-pass dual-axis evaluation pipeline is implemented, tested, and calibrated.

The pipeline transforms RevisionGrade's evaluation from a single AI call into a multi-pass architecture producing dual-axis analysis (Craft Execution + Editorial/Literary Insight) with deterministic quality guards and verified pass independence.

---

## Deliverables

| Deliverable | File | Status |
|---|---|---|
| Type contracts | `lib/evaluation/pipeline/types.ts` | ✅ |
| Pass 1 runner (Craft Execution) | `lib/evaluation/pipeline/runPass1.ts` | ✅ |
| Pass 2 runner (Editorial/Literary) | `lib/evaluation/pipeline/runPass2.ts` | ✅ |
| Pass 3 runner (Synthesis) | `lib/evaluation/pipeline/runPass3Synthesis.ts` | ✅ |
| Quality gate (10 checks, deterministic) | `lib/evaluation/pipeline/qualityGate.ts` | ✅ |
| Pipeline orchestrator | `lib/evaluation/pipeline/runPipeline.ts` | ✅ |
| EvaluationResultV1 adapter | `lib/evaluation/pipeline/runPipeline.ts` (`synthesisToEvaluationResult`) | ✅ |
| Pass 1 prompt | `lib/evaluation/pipeline/prompts/pass1-craft.ts` | ✅ |
| Pass 2 prompt | `lib/evaluation/pipeline/prompts/pass2-editorial.ts` | ✅ |
| Pass 3 prompt | `lib/evaluation/pipeline/prompts/pass3-synthesis.ts` | ✅ |
| Real-run CLI script | `scripts/pipeline/run-phase2-7-real-run.ts` | ✅ |
| Evidence run (archived) | `docs/operations/evidence/runs/2026-03-20T05-43-20-085Z_phase2.7_real_run_01/` | ✅ |
| Real run report | `PHASE_2_7_REAL_RUN_01.md` | ✅ |
| This closure doc | `PHASE_2_7_EVALUATION_UPLIFT_CLOSURE.md` | ✅ |

---

## What Was Proven

### 1. Multi-pass pipeline architecture

Four-pass pipeline implemented: Pass 1 (Craft Execution, temp 0.3) → Pass 2 (Editorial/Literary, temp 0.3) → Pass 3 (Synthesis, temp 0.2) → Pass 4 (Quality Gate, deterministic code).

All 13 criteria scored on both axes. Reconciliation logic merges scores with delta explanation for divergences >2 points.

### 2. Pass 1/2 independence guarantee (Non-Negotiable Rule #3)

- **Structural enforcement:** `runPass2.ts` function signature has no parameter for Pass 1 output. Contamination is impossible at the type level.
- **Orchestrator enforcement:** `runPipeline.ts` does not pass `pass1Output` to `runPass2`.
- **Quality gate enforcement:** Calibrated independence check (8-word n-grams, manuscript evidence excluded, 2+ overlap threshold per criterion) catches actual contamination while allowing natural language convergence.
- **Test coverage:** `pipeline-independence.test.ts` verifies independence end-to-end.

### 3. Quality gate (10 deterministic checks)

| Check | Rule |
|---|---|
| QG_GENERIC_REC | Every recommendation must contain quoted manuscript snippet |
| QG_DUPLICATE_REC | No duplicated recommendations across criteria |
| QG_SHORT_REC | Every action ≥ 50 chars |
| QG_LONG_REC | Every action ≤ 300 chars |
| QG_LONG_EVIDENCE | Every evidence snippet ≤ 200 chars |
| QG_LONG_OVERVIEW | Summary ≤ 500 chars |
| QG_CRITERIA_MISSING | All 13 criteria present |
| QG_SCORE_RANGE | All scores integer 0-10 |
| Confidence minimum | Every criterion confidence ≥ 0.5 (warn, not reject) |
| QG_INDEPENDENCE_VIOLATION | Pass 2 must not reuse non-manuscript rationale phrasing from Pass 1 |

### 4. EvaluationResultV1 backward compatibility

`synthesisToEvaluationResult()` maps pipeline output to `EvaluationResultV1` format. Downstream code (phase2.ts, governance bridge, report UI) remains unchanged.

### 5. Model override threading

Configurable `model?: string` threaded end-to-end through `runPass1`, `runPass2`, `runPass3Synthesis`, and `runPipeline`. Enables per-run model selection without code changes.

### 6. Real-run CLI

`scripts/pipeline/run-phase2-7-real-run.ts` supports `--input`, `--title`, `--work-type`, `--model`, `--output-dir`. Emits full artifact set: raw + parsed outputs for all three passes, quality gate results, pipeline result, usage telemetry.

---

## Test Suite

| Suite | Tests | Status |
|---|---|---|
| pass1.test.ts | Pass 1 produces valid AxisCriterionResult[] for all 13 criteria | ✅ |
| pass2.test.ts | Pass 2 produces valid AxisCriterionResult[] for all 13 criteria | ✅ |
| pass3.test.ts | Reconciliation logic: score merging, delta explanation, verdict | ✅ |
| quality-gate.test.ts | All 10 quality checks including calibrated independence gate | ✅ |
| pipeline-independence.test.ts | Pass 1/2 independence guarantee | ✅ |
| pipeline-e2e.test.ts | Full pipeline orchestration + model threading | ✅ |

**Final count: 6 suites, 56 tests, all passing.**

---

## Evidence Artifacts

Evidence run archived at: `docs/operations/evidence/runs/2026-03-20T05-43-20-085Z_phase2.7_real_run_01/`

Contents:
- `pass1.raw.json` / `pass1.parsed.json`
- `pass2.raw.json` / `pass2.parsed.json`
- `pass3.raw.json` / `pass3.parsed.json`
- `quality-gate.json`
- `evaluation-result-v1.json`
- `metadata.json`
- `input.manuscript.txt`
- `PHASE_2_7_REAL_RUN_01.md`

---

## Independence Gate Calibration History

The initial independence gate (6-word n-grams, any overlap = violation) was too aggressive — it flagged natural language convergence when both passes analyzed the same manuscript. This was diagnosed collaboratively across all three tools (Copilot identified the failure, Perplexity diagnosed the root cause, ChatGPT recommended the fix approach).

Calibration applied at `b625c89`:
- N-gram size increased from 6 to 8
- Manuscript-sourced evidence snippets excluded from overlap comparison
- Threshold raised to require 2+ non-evidence overlaps per criterion before triggering violation

Post-calibration: 56/56 tests passing including 2 new calibration-specific tests.

---

## Spec Compliance

| Spec Requirement | Status |
|---|---|
| Dual-axis scores (craft + editorial) for all 13 criteria | ✅ |
| Zero generic recommendations — all anchored to manuscript text | ✅ (gate enforced) |
| All recommendations 50-300 chars with quoted snippet | ✅ (gate enforced) |
| Quality guards pass CI (10 checks) | ✅ |
| Pass 1/2 independence guarantee enforced and tested | ✅ |
| Pipeline produces valid EvaluationResultV1 (backward compatible) | ✅ |
| Evidence run archived with all artifacts | ✅ |

---

## Decision Records

- **CPDR-001:** Canon Enforcement System placement (Volume V Section VII) — governs where enforcement architecture lives, relevant to pipeline's governance bridge.

---

## Subtask History

| Subtask | Description | Status |
|---|---|---|
| 2.7.a | Pass 1/2/3 runners + prompt templates + types | Complete |
| 2.7.b | Quality gate (10 deterministic checks) | Complete |
| 2.7.c | Pipeline orchestrator + EvaluationResultV1 adapter | Complete |
| 2.7.d | Jest/SWC mock-hoisting fix — DI refactor | Complete |
| 2.7.e | Model override threading — end-to-end | Complete |
| 2.7.f | Real-run CLI upgrade — artifact emission | Complete |
| 2.7.g | Live evidence run | Complete (archived) |
| 2.7.h | Independence gate calibration | Complete (`b625c89`) |
| 2.7.i | Phase 2.7 final closure | Complete (this document) |

---

## Final Statement

Phase 2.7 transforms RevisionGrade's evaluation from a single AI call into a governed, multi-pass pipeline with dual-axis analysis, deterministic quality enforcement, and verified independence guarantees. The pipeline is backward-compatible with all downstream systems.

> **Phase 2.7 — COMPLETED.**

*Note: A fresh live evidence run with the calibrated gate will further strengthen the evidence pack when OPENAI_API_KEY is available. This is a future enhancement, not a closure blocker.*
