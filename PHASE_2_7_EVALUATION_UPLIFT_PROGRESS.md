# Phase 2.7 — Evaluation Uplift: Progress Report

**Status:** IN PROGRESS — scaffold complete, test harness proven  
**Date:** 2026-03-19  
**Owner:** Mike Meraw  
**Commits:** `a6f0492`, `9ef8afe`, `c91f26c`  
**Suite:** 6 suites, 52 tests, all passing  

---

## 1. What Was Implemented

### Pipeline Scaffold (9 production files)

| File | Purpose | Lines |
|------|---------|-------|
| `lib/evaluation/pipeline/types.ts` | Type contracts: SinglePassOutput, SynthesisOutput, PipelineResult, QualityGateResult | 121 |
| `lib/evaluation/pipeline/runPass1.ts` | Pass 1 runner (Craft Execution axis) + `parsePass1Response` pure parser | 167 |
| `lib/evaluation/pipeline/runPass2.ts` | Pass 2 runner (Editorial/Literary axis) + `parsePass2Response` pure parser | 177 |
| `lib/evaluation/pipeline/runPass3Synthesis.ts` | Pass 3 runner (Synthesis & Reconciliation) + `parsePass3Response` pure parser | 228 |
| `lib/evaluation/pipeline/runPipeline.ts` | Orchestrator: Pass 1→2→3→4 sequencing + `synthesisToEvaluationResult` adapter | 241 |
| `lib/evaluation/pipeline/qualityGate.ts` | Pass 4: 10 deterministic quality checks (no AI) | 214 |
| `lib/evaluation/pipeline/prompts/pass1-craft.ts` | System prompt + user prompt builder for craft execution analysis | 83 |
| `lib/evaluation/pipeline/prompts/pass2-editorial.ts` | System prompt + user prompt builder for editorial/literary analysis | 89 |
| `lib/evaluation/pipeline/prompts/pass3-synthesis.ts` | System prompt + user prompt builder for synthesis & reconciliation | 102 |

### Test Suite (6 test files, 52 tests)

| File | Tests | What It Proves |
|------|-------|----------------|
| `pass1.test.ts` | 10 | Pure parser: 13 criteria, score clipping, unknown key filtering, JSON errors. DI runner: completion injection, empty response, error propagation. |
| `pass2.test.ts` | 7 | Pure parser: editorial axis, score clipping, JSON errors. DI runner: completion injection, type-level independence (no pass1 field on RunPass2Options). |
| `pass3.test.ts` | 9 | Pure parser: synthesis, score clipping, fallback averaging, delta explanation. DI runner: completion injection, empty response. |
| `pipeline-e2e.test.ts` | 12 | Full pipeline: success path, PASS1/2/3_FAILED error codes, QG rejection, fail-closed ordering. EvaluationResultV1 adapter mapping. |
| `pipeline-independence.test.ts` | 4 | Non-Negotiable Rule #3: Pass 2 never receives Pass 1 output. Pass 3 receives both. Fail-closed on Pass 1/2 errors. |
| `quality-gate.test.ts` | 15 | All 10 QG error codes: QG_CRITERIA_MISSING, QG_SCORE_RANGE, QG_GENERIC_REC, QG_SHORT_REC, QG_LONG_REC, QG_LONG_EVIDENCE, QG_LONG_OVERVIEW, QG_DUPLICATE_REC, QG_INDEPENDENCE_VIOLATION. |

---

## 2. What Was Proven

### Architecture

- **Dual-axis evaluation works:** Pass 1 (craft) and Pass 2 (editorial) produce independent `SinglePassOutput` objects with distinct prompts and scoring
- **Independence guarantee holds:** Type system + runtime checks prevent Pass 2 from receiving Pass 1 data
- **Quality gate is deterministic:** 10 checks run without AI, catching missing criteria, score range violations, generic/duplicate/short/long recommendations, evidence length, and cross-contamination
- **EvaluationResultV1 compatibility:** `synthesisToEvaluationResult` maps pipeline output to the existing schema — downstream code (phase2.ts, report UI, A6 credibility) works unchanged

### Test Harness

- **Jest/SWC mock-hoisting problem solved:** `next/jest` SWC transform breaks `jest.mock` for both third-party (`openai`) and local (`@/lib/...`) modules. Root cause: ESM → CJS transform runs before Jest hoisting
- **Solution: zero `jest.mock` calls.** Dependency injection via:
  - `_createCompletion` parameter on runners (injects fake OpenAI client)
  - `_runners` parameter on pipeline (injects fake runner functions)
  - Pure parser functions (`parsePass1Response`, etc.) tested directly — no I/O, no mocking needed
- **52 tests run in 1.5 seconds** — no network calls, no flakiness

---

## 3. What Remains for Full 2.7 Closure

Phase 2.7 is a scaffold, not a finished product. The following work remains before marking 2.7 as Completed:

### Must-Have (blocking closure)

1. **Integration with existing evaluation flow** — wire `runPipeline` into `lib/evaluation/processor.ts` or the API route (`app/api/evaluate/route.ts`) so real evaluations use the multi-pass pipeline
2. **Prompt tuning** — current prompts are structurally correct but need iteration against real manuscripts to produce senior-editor-quality output
3. **End-to-end validation** — run the full pipeline against 3-5 test manuscripts, verify output quality, adjust prompts and quality gate thresholds
4. **Error handling refinement** — retry logic, partial failure recovery, timeout handling for long manuscripts

### Nice-to-Have (can follow after closure)

5. **Performance baseline** — measure token usage and latency for the 3-call pipeline
6. **Artifact persistence** — write pipeline results to the database with full provenance
7. **A6 integration** — feed pipeline metadata into A6 credibility scoring

---

## 4. Commit Evidence

| SHA | Message | What Changed |
|-----|---------|--------------|
| `a6f0492` | wip: 2.7 pipeline scaffold — 21/39 passing, parser extraction needed | Initial scaffold: 9 lib files + 6 test files. Quality gate passes (15/15). Other 5 suites fail due to jest.mock/SWC incompatibility. |
| `9ef8afe` | fix: eliminate jest.mock — DI for runners + pure parser tests | Replaced all jest.mock with dependency injection. 51/52 passing. |
| `c91f26c` | fix: e2e test fixtures — distinct rationale text avoids QG_INDEPENDENCE_VIOLATION | Fixed test fixture n-gram collision. 52/52 passing. |

---

## 5. Test Evidence

```
Test Suites: 6 passed, 6 total
Tests:       52 passed, 52 total
Snapshots:   0 total
Time:        1.537 s
```

Pipeline: `tests/evaluation/pipeline/`  
Command: `npm test -- tests/evaluation/pipeline/ --runInBand`  
Environment: GitHub Codespace `shiny-chainsaw-5gjw9q97w4w637r9v`  
Date: 2026-03-19 ~20:47 MST  

---

## 6. Governance Notes

- **Canon alignment:** Prompts reference Vol II (13 Criteria), Vol III Tools (§PASS1/PASS2/PASS3 temperatures), Vol IV (§multi-AI consensus architecture)
- **No schema migrations:** Phase 2.7 adds no new DB tables per spec §2 Non-Goals
- **No UI changes:** Report rendering remains as-is per spec §2
- **Roadmap updated:** 2.7 → In Progress, Sprint 0 subtasks 2.7.a-d added with SUCCESS CRITERIA, TEST METHOD, OUTPUT ARTIFACT
