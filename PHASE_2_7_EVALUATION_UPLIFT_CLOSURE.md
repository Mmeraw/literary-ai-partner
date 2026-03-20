# Phase 2.7 — Evaluation Uplift (Pass 1-4, Dual Axis)

**Status:** ❌ NOT CLOSED  
**Date:** 2026-03-20  
**Current Commit:** `c91f26c`  
**Implementer:** GitHub Copilot  
**Spec Author:** ChatGPT  
**Governance Review:** Perplexity feedback incorporated  

---

## Executive Verdict

Phase 2.7 is **implementation-strong but not closure-complete**.

The pipeline architecture, test coverage, model override threading, and real-run script hardening are in good shape. However, **final closure is withheld** because the live evidence currently in the repository shows a **quality gate failure on pass independence**, and a fresh upgraded evidence run could not be generated in this environment because `OPENAI_API_KEY` is not set.

This means the correct governance state is:

- **Implementation status:** substantially complete
- **Spec compliance status:** partially proven
- **Closure state:** blocked pending fresh live evidence

---

## What Is Verified

### 1. Multi-pass evaluation pipeline exists and is tested

The following implementation is present and verified in the repository:

- `lib/evaluation/pipeline/runPass1.ts`
- `lib/evaluation/pipeline/runPass2.ts`
- `lib/evaluation/pipeline/runPass3Synthesis.ts`
- `lib/evaluation/pipeline/qualityGate.ts`
- `lib/evaluation/pipeline/runPipeline.ts`
- `scripts/pipeline/run-phase2-7-real-run.ts`

The targeted Phase 2.7 test suite passed locally during this session:

- **6/6 suites passed**
- **54/54 tests passed**

This verifies:

- Pass 1 → Pass 2 → Pass 3 → Quality Gate orchestration
- fail-closed behavior
- typed Pass 2 independence at the runner interface
- model override threading through all three passes
- continued `EvaluationResultV1` compatibility

### 2. CLI/operator interface now matches the real-run intent

The hardened script supports the operator-facing inputs expected by the Phase 2.7 audit:

- `--input`
- `--title`
- `--work-type`
- `--model`
- `--output-dir`

It is also wired to emit the required artifact family on a fresh run:

- `pass1_raw.json`
- `pass1_parsed.json`
- `pass2_raw.json`
- `pass2_parsed.json`
- `pass3_raw.json`
- `pass3_parsed.json`
- `quality_gate.json`
- `pipeline_result.json`
- `usage.json`

Plus supporting evidence files:

- `input.manuscript.txt`
- `metadata.json`
- `evaluation-result-v1.json`
- `PHASE_2_7_REAL_RUN_01.md`

### 3. Real evidence does exist

The repository contains a live evidence run at:

- `docs/operations/evidence/runs/2026-03-20T05-43-20-085Z_phase2.7_real_run_01/`

That run includes:

- `pass1.raw.json`
- `pass1.parsed.json`
- `pass2.raw.json`
- `pass2.parsed.json`
- `pass3.raw.json`
- `pass3.parsed.json`
- `quality-gate.json`
- `evaluation-result-v1.json`
- `metadata.json`
- `PHASE_2_7_REAL_RUN_01.md`

The run metadata shows:

- manuscript: `Toadstone Power of Belief — Chapter 1`
- work type: `novel_chapter`
- word count: `486`
- quality gate pass: `false`

---

## Why Closure Is Withheld

### 1. Live quality gate failed on independence

The current evidence run failed with:

- `QG_INDEPENDENCE_VIOLATION`

Recorded in:

- `docs/operations/evidence/runs/2026-03-20T05-43-20-085Z_phase2.7_real_run_01/quality-gate.json`

Failure detail:

- `3 Pass 2 criterion/criteria contain verbatim Pass 1 phrases`

This is a hard gate because the repository governance explicitly treats Pass 2 independence as non-negotiable.

### 2. Practical independence failure is visible in live artifacts

Using the live `pass1.raw.json` and `pass2.raw.json`, the overlapping six-word rationale phrases include:

- `character` → `while hyla is introduced as a`
- `dialogue` → `there is a lack of direct`
- `dialogue` → `is a lack of direct dialogue`
- `narrativeClosure` → `the excerpt lacks a clear sense`
- `narrativeClosure` → `lacks a clear sense of closure`

This is exactly the kind of practical cross-contamination the quality gate is designed to reject.

### 3. The existing evidence predates the upgraded artifact set

The live evidence directory currently in the repository does **not** contain:

- `usage.json`
- `pipeline_result.json`

Those files are produced by the upgraded script now present on `main`, but they are **not yet represented in a fresh live run**.

So while the code path is ready, the evidence set is still incomplete for final closure.

### 4. Fresh real-run verification is blocked in this environment

During this session, a shell-level check confirmed:

- `OPENAI_API_KEY` present: `false`

Because of that, a fresh upgraded live run could not be executed here.

---

## Current Go / No-Go Assessment

| Area | Status | Notes |
| --- | --- | --- |
| Pipeline implementation | ✅ | Core pass orchestration and deterministic quality gate are in place |
| Test coverage | ✅ | 54/54 targeted pipeline tests passed |
| Model override threading | ✅ | Verified through runner + orchestrator tests |
| Real-run CLI hardening | ✅ | Script accepts the intended operator inputs |
| Real evidence exists | ✅ | One manuscript run archived in `docs/operations/evidence/runs/...` |
| Quality gate success on live run | ❌ | Failed on `QG_INDEPENDENCE_VIOLATION` |
| Upgraded artifact set present in live run | ❌ | Current archived run lacks `usage.json` and `pipeline_result.json` |
| Fresh rerun from upgraded script | ❌ | Blocked here by missing `OPENAI_API_KEY` |
| Phase 2.7 closure | ❌ | Must remain open |

---

## What Must Happen Before Closure

Phase 2.7 can be closed only after all of the following are true:

1. **Run a fresh manuscript through the upgraded script**  
   The new run must be generated by the hardened `scripts/pipeline/run-phase2-7-real-run.ts`.

2. **Archive the complete upgraded artifact set**  
   The evidence directory must include at minimum:
   - `quality_gate.json`
   - `pipeline_result.json`
   - `usage.json`
   - raw + parsed outputs for all three passes

3. **Demonstrate live independence success**  
   Pass 1 and Pass 2 raw outputs must survive the deterministic independence check with no verbatim six-word carryover in rationale text.

4. **Confirm quality gate result from live evidence**  
   The new run must either:
   - pass the quality gate, or
   - fail with documented reasons that are then corrected and re-run

5. **Refresh this document to closed status only after evidence exists**  
   At that point, this file may be updated from `❌ NOT CLOSED` to `✅ COMPLETED` with the final evidence directory and published commit.

---

## Recommended Immediate Next Step

Run one fresh real manuscript evaluation using the upgraded script in an environment where `OPENAI_API_KEY` is set, then inspect:

- `quality_gate.json`
- `pipeline_result.json`
- `usage.json`
- `pass1_raw.json`
- `pass2_raw.json`

If the independence check still fails, prompt tuning must happen before Phase 2.7 can close.

---

## Final Statement

This phase should be treated as a **strong intermediate checkpoint**.

The implementation work is real and materially advances Phase 2.7, but the governance-correct answer is:

> **Do not mark Phase 2.7 complete yet.**

Closure remains blocked on a fresh upgraded real-run evidence pack and a live demonstration that Pass 2 remains independent of Pass 1 under actual model execution.