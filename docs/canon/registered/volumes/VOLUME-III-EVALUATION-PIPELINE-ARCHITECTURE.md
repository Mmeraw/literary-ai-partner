---
canon_status: secondary
domain: volume-iii-evaluation-pipeline-architecture
supersedes: []
superseded_by: null
runtime_binding: false
---

# VOLUME III — EVALUATION PIPELINE ARCHITECTURE (PASS SYSTEM)

Status: CANONICAL — ACTIVE
Version: 1.0
Authority: Mike Meraw
Canon ID: VOL-III-EVAL-PIPELINE-V10
Last Updated: 2026-06-09
Source: Summary-Evaluation-Build-Passes-1-3-activity-22-Mar-2026

---

## 1. Purpose

This volume defines the multi-pass evaluation architecture of the RevisionGrade system. It establishes how manuscript evaluation transitions from analysis → divergence → convergence → revision action.

This volume is not advisory. It defines the evaluation pipeline through which all manuscripts must pass.

---

## 2. System Overview

The RevisionGrade Evaluation Pipeline is composed of three mandatory passes:

```
Original Manuscript
  → Phase 0 — Governance Warmup (calibration proof)
  → Phase 0.5a — Story Map Seed + Evaluation Seed + Full-Context Story Ledger
  → Phase 0.5b — Editorial DREAM Seed (non-fatal)
  → Phase 1A — Chunked Story Layer + Ledger Extraction (Track B)
     + Pass 3A Preflight Scout (Track C, parallel)
  → Review Gate — story layer + ledger quality + Pass 3A validity
  → Phase 2 — Pass 1 Structural + Pass 2 Editorial (parallel), then aggregate
  → Phase 3 — Pass 3 Convergence (Truth Resolution) + Quality Gate
  → WAVE Revision Engine (eligible long-form only)
  → Final Report Output
```

The canonical pass vocabulary maps to the current runtime phases:

| Volume III Pass | Runtime Phase | Code Entry |
|----------------|--------------|------------|
| Pass 1 (Structural) | Phase 2 — `runPass1()` | `runPass1.ts` |
| Pass 2 (Independent) | Phase 2 — `runPass2()` | `runPass2.ts` |
| Pass 3 (Convergence) | Phase 3 — `runPass3Synthesis()` | `runPass3Synthesis.ts` |
| Pass 4 (Quality Gate) | Phase 3 — `runQualityGateV2()` | `runPipeline.ts` |

No stage may be skipped. No stage may be merged. No stage may be bypassed.

---

## 3. Pipeline Law

### III.PL1 — Sequential Execution Rule
All passes must execute in strict order: Pass 1 → Pass 2 → Pass 3 → WAVE.
No pass may begin until the prior pass is complete and valid.

### III.PL2 — Non-Bypass Rule
No manuscript may skip a pass, combine passes, or proceed to WAVE without convergence.

### III.PL3 — Determinism Requirement
For identical input, Pass 1 must produce identical output. Pass 2 must produce independently consistent output. Pass 3 must produce identical convergence outcomes.

### III.PL4 — Authority Separation Rule
Each pass operates under distinct authority:
- Pass 1: Structural Authority
- Pass 2: Independent Analytical Authority
- Pass 3: Convergence Authority

---

## 4. Pass 1 — Structural Evaluation (Deterministic)

### III.P1.1 — Purpose
Establishes baseline structural truth using canonical criteria only.

### III.P1.2 — Behavior
- Use canonical criteria only
- Produce evidence-backed findings
- Operate deterministically
- Avoid stylistic or interpretive drift

### III.P1.3 — Output Requirements
Each criterion must include: Structural Finding, Evidence, Structural Impact, Judgment.

### III.P1.4 — Constraints
MUST NOT speculate, generalize, produce generic critique, or leave structural scope.

---

## 5. Pass 2 — Independent Evaluation (Divergence)

### III.P2.1 — Purpose
Introduces independent analytical perspective to validate or challenge Pass 1.

### III.P2.2 — Independence Rule
Must operate without reliance on Pass 1 conclusions.

### III.P2.3 — Divergence Requirement
Must allow disagreement with Pass 1. Agreement is allowed. Forced agreement is prohibited.

### III.P2.5 — Constraints
MUST NOT collapse into Pass 1 or mirror Pass 1 language.

---

## 6. Pass 3 — Convergence (Truth Resolution)

### III.P3.1 — Purpose
Resolves agreement, disagreement, and structural conflicts between Pass 1 and Pass 2.

### III.P3.2 — Resolution Rules
- Agreement: confirm and lock
- Partial Agreement: identify scope of divergence
- Disagreement: resolve with evidence priority

---

## 7. WAVE Integration

WAVE execution is permitted only after Pass 1–3 convergence.

### WAVE Invocation Rule (Canonical — Lock Version)

WAVE execution is permitted only after:
- Pass I Structural Evaluation is complete and valid
- Pass II Independent Evaluation is complete and independent
- Pass III Convergence has resolved or explicitly defined all structural conflicts
- All canonical criteria have been evaluated and finalized
- The manuscript satisfies structural viability thresholds defined in Volume II

WAVE must not:
- Operate on unevaluated manuscripts
- Bypass Pass III convergence
- Execute on structurally unstable or invalid narratives
- Reinterpret or replace evaluation findings

**WAVE exists to apply correction, not to determine truth.**

---

## 8. Final Pipeline State Model

### States (runtime phase model)
```
queued → phase_0 → phase_1a (includes seed gen + chunk extraction + Pass 3A + review gate)
  → phase_2 (Pass 1 + Pass 2 parallel, aggregate to pass12_handoff_v1)
    → phase_3 (synthesis + quality gate + WAVE + persist evaluation_result_v2)
      → complete
```

Logical pass progression within these phases:
```
DRAFT → SEEDS_GENERATED → STORY_LAYER_BUILT → REVIEW_GATE_PASSED
  → PASS_1_COMPLETE + PASS_2_COMPLETE → CONVERGED → QUALITY_GATE_PASSED
    → WAVE_ELIGIBLE → WAVE_EXECUTED → COMPLETE
```

No transitions may be skipped. No states may be bypassed.

### Failure States
- STRUCTURAL_FAILURE: blocks Pass 2 and WAVE
- INDEPENDENCE_FAILURE: blocks convergence
- CONVERGENCE_FAILURE: blocks WAVE
- WAVE_VIOLATION: invalidates revision
- VALIDATION_FAILURE: output rejected
- QG_FAILED: quality gate blocks completion

### Key Artifacts (runtime names)

| Phase | Artifact | Purpose |
|-------|----------|--------|
| Phase 0.5a | `story_map_seed_v1`, `evaluation_seed_v1` | Seed-guided extraction claims |
| Phase 0.5a | `full_context_story_ledger_v1` | 9-layer deep story ledger |
| Phase 0.5b | `editorial_dream_seed_v1` | Early editorial assessment |
| Phase 1A | `pass1a_chunk_cache_v1`, `pass1a_character_ledger_v1` | Per-chunk extraction + merged ledger |
| Phase 1A | `pass1a_story_layer_v1`, `ledger_quality_report_v1` | Story layer + quality assessment |
| Phase 1A | `seed_contradiction_report_v1` | Seed consistency check |
| Pass 3A | `pass3_preflight_draft_v1` | Independent full-manuscript preflight |
| Review Gate | `accepted_story_ledger_v1` | Story layer accepted for Phase 2 |
| Phase 2 | `pass1_chunk_cache_v1`, `pass2_chunk_cache_v1` | Per-chunk structural + editorial results |
| Phase 2 | `pass12_handoff_v1` | Aggregated handoff to Phase 3 |
| Phase 3 | `evaluation_result_v2` | Final normalized evaluation result |
| WAVE | `revision_opportunity_ledger_v1` | Revision opportunities (eligible long-form) |

---

## 9. Final Doctrine

This pipeline is not a workflow. It is a governed state machine that controls narrative evaluation, revision, and validation.

**One-Line System Law:** A manuscript may advance only if its current state is valid, complete, and passes all required gate conditions — otherwise, progression is blocked.
