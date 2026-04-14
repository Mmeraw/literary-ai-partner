# VOLUME VI -- GOVERNANCE FRONT-END VISIBILITY (UI & WIREFRAMES)

**Canon ID:** VOL-VI-UI-GOV-V10
**Status:** ACTIVE
**Authority:** Mike Meraw
**Last Updated:** 2026-04-10
**Version:** 4.0

---

## Purpose

Volume VI defines the user-facing visibility layer for the RevisionGrade governance system. The UI is not an interface -- it is the visible expression of system authority.

---

## Section 7 -- User Visibility UI Visual System

### VI.UI1 -- Score Display
The system shall display all 13 criterion scores in canonical order with visual bands.

### VI.UI2 -- Evidence Display
Evidence must show exact manuscript snippets with character offsets.

### VI.UI3 -- Convergence Display
Pass 1/Pass 2/Pass 3 convergence must be visible per criterion.

### VI.UI4 -- Gate Status Display
All gate results (PASS/FAIL) must be shown with reasons.

### VI.UI5 -- Detection Summary
Q1-Q5 category counts with threshold comparisons.

### VI.UI6 -- Flagged Lines Table
Violations in structured table: line number, matched term, category (Q1-Q5, D1-D3), contextual excerpt, required action. Must support sorting/filtering by category.

### VI.UI7 -- Governance Log Panel
Gate identifier, PASS/FAIL decision, reason, resulting state, timestamp. Log must be immutable.

### VI.UI8 -- Action Controls
Re-run Detection, Execute Structural Validation, Submit Exception, Resubmit Chapter. State-aware enable/disable.

### VI.UI9 -- Evidence Panel (Audit Visibility)
Validator output, structural validation results, governance logs, exception records, source hash. Availability status.

### VI.UI10 -- Artifact Access and Download
Individual artifact downloads and complete audit bundle download. Unavailable artifacts visibly disabled.

### VI.UI11 -- UI State Synchronization
UI must always reflect current system state. No cached/stale results without indication.

### VI.UI12 -- Error and Empty States
Explicit representation of: no violations, empty flagged table, missing artifacts, loading states. No silent failures.

### VI.UI13 -- Non-Ambiguity Rule
At all times user must determine: current state, pass/fail status, location of violations, required corrective action. If a user must infer meaning, the UI has failed.

### VI.UI14 -- UI Determinism
For identical system state, UI must render identical output.

### VI.UI15 -- System Integrity Through Visibility
Users cannot miss failures. Violations cannot be hidden. Decisions cannot be misunderstood.

### VI.UI16 -- Final Doctrine
The UI is not an interface. The UI is the visible expression of system authority.

---

## Section 8 -- Audit Doctrine

### VI.AD1 -- Audit Law
Every decision shall be recorded, reproducible, verifiable, retrievable. No decision is valid without complete audit evidence. Audit is the preservation of truth over time.

### VI.AD2 -- Purpose of Audit
All outputs independently verifiable. All decisions traceable to origin. All inputs and transformations preserved. All exceptions documented.

### VI.AD3 -- Required Audit Artifacts

#### VI.AD3.1 -- Detection Output
Counts per category (Q1-Q5), threshold comparisons, pass/fail per metric, line-level flagged instances, contextual excerpts.

#### VI.AD3.2 -- Structural Validation Output
Results for D1, D2, D3 with evaluation outcomes and supporting reasoning.

#### VI.AD3.3 -- Governance Log
Gate identifier, final PASS/FAIL, reason, resulting state, timestamp.

#### VI.AD3.4 -- Exception Log
Line reference, matched element, category, justification, approver identity, timestamp. If no exceptions, explicitly recorded.

#### VI.AD3.5 -- Source Integrity Record
Hash of raw input, hash of normalized input. Ensures input integrity and reproducibility.

---

## Architectural Truth

> Every evaluation must be reproducible. Evidence must be complete. Absence of evidence invalidates authority.
