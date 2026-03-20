# LESSONS LEARNED — PHASE 2.7

## Pass 1 Structural Diagnostic Design Rationale

**Status:** LOCKED — Phase 2.7 Calibration Design  
**Date:** March 20, 2026  
**Authors:** ChatGPT (formulation), Perplexity (validation + governance)

---

## 1. Decision Summary

Pass 1 of the RevisionGrade evaluation pipeline is restricted to four structural systems:

- Scene Function
- Escalation
- Causality
- Authority

This constraint is intentional and non-negotiable for calibration.

---

## 2. Core Principle

Pass 1 is not a general evaluation pass.  
It is a structural diagnostic layer designed to identify failure at the level of narrative physics.  
The goal is not descriptive feedback, but failure classification.

---

## 3. Why These Four Systems

These four systems were selected because they represent the irreducible primitives of narrative function.

Each answers a fundamental question:

| System | Question |
|---|---|
| Scene Function | What changes? |
| Escalation | Does pressure increase? |
| Causality | Why does this happen? |
| Authority | Who controls perception, meaning, and action? |

Together, they form a closed system.  
All narrative failures can be reduced to one or more of these domains.

---

## 4. Reduction Logic (Why Other Categories Were Excluded)

The following categories were explicitly considered and rejected as Pass 1 primitives:

### Theme
Rejected because theme is emergent, not causal.  
It arises from decisions, escalation, and consequence — not independently.

### Character
Rejected because character is expressed through:
- decisions (Scene Function)
- responses (Escalation)
- consequences (Causality)
- perception (Authority)

It is not an independent structural system.

### Pacing
Rejected because pacing is a derivative effect of:
- scene function
- escalation progression

### Prose / Style
Rejected because these belong to Pass 2 (Expression Layer).  
They describe how structure is expressed, not whether structure works.

### WAVE Constructs (50+ items)
Rejected for Pass 1 because they are:
- expression-level diagnostics
- pattern-specific, not universal

They are activated in Pass 2.

### Scene Entry / Opening Discipline
Not included as a primary Pass 1 system.  
**Reason:** It is a specialized manifestation of Scene Function failure, not an independent structural primitive.  
**Handled within:** Scene Function diagnostics (Pass 1) — an opening that fails to anchor character action is a scene function failure subtype, not a separate category.

---

## 5. System Architecture Insight

The evaluation pipeline is intentionally layered:

| Pass | Role | Scope |
|---|---|---|
| Pass 1 (Structure) | Detects what is broken | 4 core primitives |
| Pass 2 (Expression) | Diagnoses how it manifests | WAVE + 13 Criteria |
| Pass 3 (Synthesis) | Prioritizes and sequences fixes | Cross-layer integration |

Expanding Pass 1 to include expression-level diagnostics would:
- dilute structural detection
- reintroduce generic output
- break checklist alignment

---

## 6. Checklist Alignment (Layer Isolation)

Pass 1 is scored against structural MUST DETECT items only:

| Checklist Item | Failure Type | Pass |
|---|---|---|
| MD-2 | Scene Function Failure | Pass 1 |
| MD-3 | Authority Transfer Blur | Pass 1 |
| MD-4 | Cause–Effect Visibility Gap | Pass 1 |
| MD-5 | Escalation Failure | Pass 1 |

**Explicitly excluded from Pass 1 scoring:**

| Checklist Item | Failure Type | Pass |
|---|---|---|
| MD-1 | Thematic Overstatement | Pass 2 |
| MD-6 | Metaphor System Conflict | Pass 2 |

MN-1 through MN-5 (MUST NOT PRODUCE) apply to all passes.

---

## 7. Failure Type Criteria (Inclusion Rules)

A failure type qualifies for Pass 1 only if it:

1. Exists independently of prose style
2. Affects narrative function globally
3. Can be detected without line-level analysis
4. Produces downstream failure across multiple criteria

The four selected systems meet all criteria.

---

## 8. Structural Sufficiency Claim

The system asserts:

> No narrative failure exists that cannot be reduced to Scene Function, Escalation, Causality, or Authority.

This claim is foundational to the Pass 1 design.  
It is testable: if calibration produces a failure that cannot be reduced to these four primitives, the claim is falsified and the system evolves.

---

## 9. Known Risk

The system may initially appear too narrow, especially to users expecting comprehensive critique in a single pass.

---

## 10. Mitigation Strategy

Breadth is introduced in:
- Pass 2 (WAVE + 13 Criteria)
- Pass 3 (Synthesis and prioritization)

The system is narrow by layer, not narrow overall.

---

## 11. Calibration Requirement

Strict constraint at Pass 1 is required for:
- checklist alignment (MD/MN gates)
- deterministic output
- comparability against the gold standard
- Phase 2.7 validation

Flexibility is intentionally deferred to later phases.

---

## 12. Future Expansion Candidates (Post-Calibration Only)

The following structural failure types may be added to Pass 1 after calibration validates or challenges the sufficiency claim:

- **Irreversibility Failure** — scene ends in same state it began
- **Decision Vacuum** — no character makes a consequential choice
- **Compulsion Loop Failure** — reader engagement mechanism breaks

These are NOT active. They require empirical evidence from pipeline runs before promotion.

---

## 13. Governance

This decision is frozen for calibration purposes and should not be modified unless:
- a structural failure is discovered that cannot be reduced to the four systems
- or empirical pipeline testing invalidates the sufficiency claim

**Canon tells the system what is true.**  
**Rationale explains why it must be true.**

This document is the rationale layer. It must never be merged into the canon documents themselves.
