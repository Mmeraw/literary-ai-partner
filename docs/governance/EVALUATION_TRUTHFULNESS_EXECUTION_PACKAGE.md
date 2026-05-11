# Evaluation Truthfulness Execution Package

**Status**: PROPOSED LOCK — becomes LOCKED when merged
**Visibility**: [PROTECTED]
**Scope**: Diagnostic and architectural sequencing for evaluation engine truthfulness
**Owner**: Mmeraw
**Created**: 2026-05-11
**References**: #289, #309, #384, #417, #435

---

## Executive Summary

We are pausing visible editorial-output implementation until the evaluation engine is proven trustworthy.

The editorial output governance brief is locked (#435) and the translation layer governance brief is locked (#417). Both will resume after the evaluation engine itself is diagnosed and stabilized.

**Diagnostic-before-remediation principle**: No fixes, no architecture changes, no QualityGate weakening, no scoring modifications until the root cause of divergence collapse is empirically classified.

The next sequence is:

1. Diagnostic PR for #289
2. Architecture design doc for #384
3. Golden divergence/evidence fixtures

No scoring changes, prompt rewrites, UI work, or QualityGate weakening unless diagnostics prove the exact need.

**Start with Section 1 only.** Do not begin Sections 2 or 3 until Section 1 diagnostic evidence is reviewed.

---

## 1. Diagnostic PR for #289 — Divergence Collapse

### Goal

Prove where divergence disappears.

We need to determine whether `agree:13 / soft_divergence:0 / hard_divergence:0` is caused by:

- Pass 1/2 sampler starvation
- comparison packet compression
- Pass 2 non-independence
- Pass 3 synthesis flattening disagreement
- all of the above

### Scope

**Diagnostic-only.**

Allowed:
- telemetry emission
- debug artifacts
- read-only diagnostic helpers
- tests proving telemetry shape

Not allowed:
- no QualityGate changes
- no scoring changes
- no prompt changes unless separately approved
- no UI changes
- no map-reduce implementation yet
- no "fix" hidden inside diagnostics

### Diagnostic Integrity Constraint

The diagnostic PR must preserve the exact live evaluation behavior while instrumentation is collected.

Specifically:
- no prompt-token-budget changes
- no comparison-packet resizing
- no chunk-selection logic changes
- no synthesis arbitration changes
- no gate-threshold changes
- no confidence-calculation changes
- no score-normalization changes

The diagnostic must observe the current system, not a partially modified one.

Any behavior-affecting change invalidates the empirical value of the telemetry and requires a separate PR after diagnostic review.

**Integrity acceptance:**
- baseline manuscript reruns before/after instrumentation produce identical evaluation outputs except for additive telemetry/debug artifacts
- any output drift must be explained explicitly in the PR body

**Rationale:** The purpose of Section 1 is forensic attribution, not remediation. The telemetry must describe the live failure mode exactly as it exists today.

### Required telemetry

For each run, persist or emit:

```ts
{
  manuscript_words: number;
  manuscript_chars: number;
  chunk_count: number;
  chunks_analyzed_pass1: number;
  chunks_analyzed_pass2: number;
  chunk_coverage_pct_pass1: number;
  chunk_coverage_pct_pass2: number;

  pass1_prompt_chars: number;
  pass2_prompt_chars: number;

  comparison_packet_chars: number;
  comparison_packet_retained_ratio: number;

  pass1_pass2_criterion_state_pre_synthesis: {
    [criterionKey: string]: {
      pass1_score: number | null;
      pass2_score: number | null;
      score_delta: number | null;
      rationale_overlap_count: number;
      apparent_state: "agree" | "soft_divergence" | "hard_divergence" | "missing_or_invalid";
    }
  };

  pass3_criteria_count_by_state: {
    agree: number;
    soft_divergence: number;
    hard_divergence: number;
    missing_or_invalid: number;
  };

  divergence_collapse_detected: boolean;
}
```

### Required diagnostic question

Answer this explicitly in the PR body:

> **Did Pass 1 and Pass 2 disagree before Pass 3, and did Pass 3 collapse that disagreement?**

### Required empirical classification

The diagnostic must explicitly determine whether divergence existed in raw Pass 2 output before comparison packet construction.

The PR must answer:

> **Did divergence exist in raw Pass 2 output and get lost downstream, or did it never exist?**

This distinction is mandatory because the remediation path depends entirely on where divergence disappears. The PR must classify which of these four failure modes is actually occurring:

**1. Pass 2 never diverges from Pass 1**  
→ Root cause is Pass 2 independence failure  
→ Likely prompt-contract / independence-hardening issue

**2. Pass 2 diverges, but Pass 3 collapses disagreement**  
→ Root cause is synthesis flattening  
→ Likely Pass 3 synthesis behavior issue

**3. Pass 2 diverges, but comparison packet compression erases divergence before Pass 3 sees it**  
→ Root cause is representation collapse  
→ Likely comparison-packet construction issue

**4. Coverage too low for divergence to be observable**  
→ Root cause is sampler starvation  
→ #384 map-reduce architecture required

The PR must use these fields to support the answer:
- `pass1_pass2_criterion_state_pre_synthesis`
- `comparison_packet_retained_ratio`
- `chunk_coverage_pct_pass1`
- `chunk_coverage_pct_pass2`
- `pass3_criteria_count_by_state`

### Acceptance

- Same 85k-class manuscript produces diagnostic artifact
- Diagnostic artifact shows coverage %, retained ratio, and pre/post synthesis divergence state
- PR explicitly identifies whether the failure is primarily: sampler starvation, comparison compression, Pass 2 independence failure, or Pass 3 flattening
- PR classifies which of the four failure modes above is occurring, with telemetry evidence
- Baseline manuscript reruns before/after instrumentation produce identical evaluation outputs except for additive telemetry/debug artifacts
- Any output drift is explained explicitly in the PR body
- No behavior-changing fix merged in this PR
- This remains diagnostic-only: no hidden fixes, no synthesis changes, no QualityGate weakening, no scoring drift

### Refs

Refs #289, #384, #309

---

## 2. Design Doc for #384 — Map-Reduce Evaluation Architecture

> **Do not start this until Section 1 diagnostic evidence is reviewed.**

### Goal

Design chunk-native manuscript-scale cognition before implementation.

Current failure: chunk substrate may exist, but Pass 1/2 still analyze a small sampled window. Long-form evaluation must become chunk-native.

### New doc target

`docs/architecture/MAP_REDUCE_EVALUATION_ARCHITECTURE.md`

### Required sections

**Purpose**  
Explain why long-form evaluation cannot rely on one sampled prompt window.

**Current Failure Mode**  
Document:
- `manuscript_chunks` → concatenated `manuscriptText` → `buildPromptInputWindow(...)` → Pass 1 / Pass 2 see sampled window only → Pass 3 synthesizes compressed representation → divergence and evidence coverage collapse

**Proposed Architecture**
- Pass 1 map: each chunk → craft evidence
- Pass 2 map: each chunk → editorial evidence
- Pass 3 reduce: arbitrate across chunk evidence
- Pass 4 gate: validate full evidence substrate

**Contracts**  
Define:
- `ChunkEvaluationInput`
- `ChunkCraftOutput`
- `ChunkEditorialOutput`
- `CriterionEvidenceLedger`
- `ReduceSynthesisInput`
- `ReduceSynthesisOutput`

**Idempotency**  
Required key: `(chunk_id, content_hash, pass_name, prompt_version)`

**Telemetry**  
Must include:
- `chunk_count_total`
- `chunks_attempted`
- `chunks_succeeded`
- `chunks_failed`
- `chunk_coverage_pct`
- `criterion_coverage_by_chunk`
- `evidence_count_by_criterion`
- `reducer_input_chars`
- `reducer_retained_ratio`
- `divergence_preserved_pre_reduce`
- `divergence_preserved_post_reduce`

**Failure Behavior**  
Define:
- when partial chunk failure is warning
- when partial chunk failure is invalid
- minimum coverage threshold
- evidence-density threshold
- fail-closed behavior when coverage is too low

**Rollout Strategy**
- Phase 1: diagnostic-only
- Phase 2: map outputs persisted but not used for scoring
- Phase 3: reducer consumes chunk evidence
- Phase 4: gate enforces chunk coverage
- Phase 5: old sampled-window path deprecated for long-form

**Non-goals**
- no UI changes
- no scoring-weight changes
- no WAVE integration
- no editorial-output fit/gap implementation
- no QualityGate weakening

### Acceptance

- Design doc merged before map-reduce code
- Explicitly resolves #384 architecture
- References #289 and #309 as dependent diagnostics
- Includes cost envelope and caching/idempotency strategy

### Refs

Refs #384, #289, #309

---

## 3. Golden Divergence / Evidence Fixtures

> **Do not start this until Section 1 diagnostic evidence is reviewed.**

### Goal

Create permanent regression fixtures before synthesis changes resume.

Create canonical fixtures that prove the system can detect and preserve disagreement rather than always forcing agreement.

### Required fixture families

**A. True Agreement Fixture**  
Pass 1 and Pass 2 genuinely agree.  
Expected:
- mostly `agree`
- no false divergence
- normal confidence

**B. Soft Divergence Fixture**  
Pass 1 and Pass 2 differ mildly on 2–3 criteria.  
Expected:
- `soft_divergence > 0`
- no collapse to `agree:13`
- Pass 3 preserves nuance

**C. Hard Divergence Fixture**  
Pass 1 and Pass 2 strongly disagree on at least one criterion.  
Expected:
- `hard_divergence > 0`
- criterion-level disagreement survives synthesis
- quality gate does not erase disagreement

**D. Sampler Starvation Fixture**  
Long-form manuscript where only early-window sampling misses later critical evidence.  
Expected:
- diagnostic detects low chunk coverage
- evaluation cannot certify full-manuscript confidence

**E. Evidence Alignment Fixture**  
Fit/gap or recommendation text must be supported by evidence.  
Expected:
- unsupported evidence attachment fails
- relevant evidence passes

### Acceptance

- Fixtures are deterministic
- Fixtures assert exact expected divergence state
- Fixtures fail if all criteria collapse to `agree`
- Fixtures fail if evidence coverage is below threshold
- Fixtures are referenced by #289/#384 follow-up PRs

### Non-goals

- no production behavior change
- no scoring changes
- no UI changes
- no editorial-output implementation

### Refs

Refs #289, #384, #309, #435

---

## Sequence Lock

The sequence is non-negotiable:

Section 1 diagnostics  
→ review evidence  
→ Section 2 map-reduce design doc  
→ Section 3 golden divergence fixtures  
→ implementation  
→ editorial output resumes afterward

This keeps evaluation truthfulness ahead of editorial beauty.

### Final constraint

Do not start Sections 2 or 3 until Section 1 diagnostic evidence is reviewed. The diagnostic PR must stand on its own and explain where divergence disappears before any architecture or fixture lane is authored against assumptions.

### Refs (full package)

Refs #273, #274, #278, #289, #309, #311, #322, #384, #385, #408, #409, #416, #417, #435
