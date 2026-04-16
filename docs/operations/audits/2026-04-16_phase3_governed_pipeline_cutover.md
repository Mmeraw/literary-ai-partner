# Phase 3 — Governed Pipeline Cutover

**Date:** 2026-04-16  
**Precondition:** Pass 3 reducer validated on `main` (PR #138)  
**Status:** ✅ Ready for governed cutover execution

---

## 1) Purpose

This document formalizes transition from:

- unbounded multi-pass re-evaluation (legacy)

to:

- governed deterministic flow with constrained Pass 3 adjudication.

It defines:

- canonical execution roles for Pass 1/2/3
- governance injection points
- WAVE eligibility timing
- audit/evidence guarantees

---

## 2) Pipeline state: before vs after

### Before (pre-#136)

- Pass 1: evaluator
- Pass 2: independent evaluator
- Pass 3: effectively a third evaluator
- Prompt/input mass: large and unstable
- Runtime: high variance, timeout-prone
- Common risk: synthesis drift and missing-criteria collapse

### After (post-#138)

- Pass 1: structured craft evaluation
- Pass 2: structured editorial evaluation (independent)
- Pass 3: constrained adjudicator (not full evaluator)
- Input to Pass 3: deterministic comparison packet
- Prompt mass: bounded
- Runtime: materially reduced and stable under validated cap

---

## 3) Canonical pass definitions

### Pass 1 — structural evaluation

Responsibilities:

- score all canonical criteria
- extract evidence anchors
- emit mechanism-aware rationale

Constraints:

- no awareness of Pass 2 output
- no convergence/adjudication behavior

### Pass 2 — independent evaluation

Responsibilities:

- independently score all canonical criteria
- provide independent rationale and evidence

Constraints:

- no convergence logic
- no arbitration behavior

### Pass 3 — constrained adjudication

Responsibilities:

- consume comparison packet only
- resolve criterion-level disagreement
- emit final synthesis output in bounded schema

Explicit non-responsibilities:

- no unconstrained full re-evaluation
- no raw payload re-injection requests
- no narrative expansion beyond schema bounds

---

## 4) Comparison packet execution contract

Producer: `lib/evaluation/pipeline/comparisonPacket.ts`

Per-criterion contract includes:

- `key`
- `state` in `{agree, soft_divergence, hard_divergence, missing_or_invalid}`
- `pass1_score`, `pass2_score`
- `score_delta` (`number | null`)
- bounded evidence summaries with traceable anchors
- optional dispute excerpt window

Deterministic classification:

- `agree`: delta ≤ 1
- `soft_divergence`: delta 2–3
- `hard_divergence`: delta ≥ 4 (or equivalent hard conflict)
- `missing_or_invalid`: null/invalid source score path

Invariants:

- no criterion disappearance
- no implicit zero fallback for invalid/missing data
- evidence provenance remains traceable

---

## 5) Governance injection points

| Stage | Governance intent |
|---|---|
| Post Pass 1 | structural validity |
| Post Pass 2 | independence/compatibility checks |
| Pre Pass 3 | packet integrity + sufficiency |
| Post Pass 3 | convergence/output contract checks |
| Pre artifact | credibility/audit envelope |

Fail-closed policy:

- illegal or invalid transitions halt progression and surface explicit failure state.

---

## 6) WAVE execution position

WAVE eligibility begins only after:

1. Pass 3 convergence output is valid
2. governance checks pass

Pipeline order:

`Pass1 → Pass2 → Comparison Packet → Pass3 → Governance → WAVE → Artifact`

---

## 7) Performance contract (validated envelope)

From validated post-merge set (`o3`, cap 5000):

- Pass 3 prompt median ~1,872 tokens
- Pass 3 no longer dominant latency source
- Total median runtime ~57s in validated set
- quality-gate success held in stable run set

Operational model note:

- o3 requires reasoning headroom; default Pass 3 cap at 5000 is validated for stability.

---

## 8) System guarantees after cutover

- canonical criteria coverage preserved
- no silent zero-score collapse for missing/invalid paths
- deterministic constrained convergence path
- bounded and auditable synthesis input
- governance-enforced control flow

---

## 9) Remaining actions (non-architectural)

- local evidence archival decisions (commit vs stash)
- manuscript input classification (canonical vs transient)
- optional retirement of inactive local worktree branch

---

## 10) Final statement

This cutover establishes the intended long-term architecture:

- evaluation is distributed (Pass 1/2)
- convergence is constrained (Pass 3)
- governance is explicit and fail-closed
- evidence remains auditable

Status: ✅ architecture complete, validated, and ready for governed operation.
