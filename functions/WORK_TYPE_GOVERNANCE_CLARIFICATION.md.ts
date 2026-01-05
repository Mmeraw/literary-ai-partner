# Work Type Governance Clarification: NA Enforcement, Intent Supremacy, and Criteria Plan Construction

**Document Version**: 1.0.0  
**MDM Canon Version**: v1.0.0  
**Date**: 2026-01-05  
**Status**: Binding Governance Clarification

---

## Purpose

This document provides **binding interpretation** of the Work Type → Criteria Applicability Matrix (MDM Canon v1.0.0). It separates **enforceable rules** (R/O/NA semantics) from **non-binding craft guidance** (style expectations), and establishes acceptance criteria to prevent future drift.

---

## Governance Facts (Binding)

### 1. Matrix Semantics

The Work Type → Criteria Applicability matrix defines which criteria are **Required (R)**, **Optional (O)**, or **Not Applicable (NA)** for each Work Type.

**Status Code Definitions:**
- **R (Required)**: Criterion is expected and may block readiness if below threshold.
- **O (Optional)**: Criterion may be scored and commented on, but must **never** be treated as required or block readiness.
- **NA (Not Applicable)**: Criterion is **forbidden** from evaluation. See Section 2 below.
- **C (Constrained)**: Criterion is applicable but must respect constraints (e.g., forbids inventing dialogue for memoir).

### 2. NA = Hard Prohibition (MDM Rule M4)

When a criterion is marked **NA** for a Work Type:

**The evaluation engine MUST NOT:**
- Assign a score to that criterion
- Generate strengths or weaknesses for that criterion
- Penalize the manuscript for "missing" that criterion
- Generate revision directives suggesting the user add/fix that criterion (e.g., "add more dialogue," "increase conflict")
- Trigger WAVE flags or line-level suggestions for that criterion

**NA is a "dirty-data kill switch"—not a soft suggestion.**

### 3. Intent Supremacy: Declared Work Type Outranks Detection

**Rule**: Work Type detection heuristics (e.g., first-person density, reflective markers, structural cues) may **recommend or flag mismatches**, but they **MUST NOT override a user-confirmed Work Type**.

**Enforcement:**
- No evaluation runs without an explicit, auditable `final_work_type_used` field.
- Once the user confirms or selects a Work Type, the evaluation `criteriaPlan` MUST be built exclusively from the matrix for that Work Type.
- Detection signals may be logged for audit purposes, but they **cannot bypass** matrix-defined applicability.

**Why this matters**: Prevents "helpful" heuristics from quietly re-routing evaluations based on stylistic patterns (e.g., detecting high first-person density and scoring memoir as fiction).

### 4. Criteria Plan Construction

The `criteriaPlan` object is the **authoritative source** of applicability rules for an evaluation run.

**Construction rules:**
1. Load the Work Type entry from the master data matrix (`work_type_criteria_applicability.v1.json`).
2. For each of the 13 canonical criteria, apply the R/O/NA/C status from the matrix.
3. Build enforcement flags:
   - `scoreEnabled`: true if R/O/C, false if NA
   - `blockingEnabled`: true if R, false otherwise
   - `canPenalize`: true if R/O, false if NA/C
   - `isNA`: true if NA

**No fallback defaults**. If a Work Type is missing from the matrix, the system MUST block evaluation and report the failure.

### 5. Full Coverage Validation (MDM Rule M3)

**Rule**: Every Work Type in the matrix MUST define a status (R/O/NA/C) for all 13 canonical criteria.

**Enforcement**: The `validateWorkTypeMatrix` function performs fail-fast validation:
- Missing criteria → block evaluation, report to Sentry
- Extra criteria → warning, but do not block
- Invalid status codes → block evaluation

This ensures the matrix is **complete and unambiguous** before any evaluation runs.

---

## Non-Binding Guidance (Craft Expectations)

**Label**: The following statements are **style observations**, not enforceable rules.

### Typical Characteristics of Reflective Prose

Reflective nonfiction (personal essays, memoirs) often exhibits:
- High first-person presence ("I," "me," "my")
- Interior reflection rather than dramatized dialogue
- Meaning-making and thematic resonance over external conflict
- Emphasis on voice, authenticity, and emotional truth

**Implication for Optional criteria**: When a criterion is marked **O** (e.g., Dialogue in Memoir Vignette), suggestions should be framed as **optional craft enhancements**—not deficits or requirements.

**Example (correct framing):**  
✅ "Consider adding one brief exchange to ground the reader in the physical setting—optional."

**Example (incorrect framing):**  
❌ "Dialogue is missing. Add dialogue to meet professional standards."

---

## Acceptance Fixtures (Required)

### Fixture 1: Personal Essay (Birthday Reflection)

**Text**: 
```
It was my 30th birthday last week. I spent it alone in my apartment, eating takeout and watching old movies. The silence felt heavier than usual—not oppressive, just noticeable. My mother called to ask if I had plans. I lied and said I did. Later that night, I thought about what it means to mark time this way, to celebrate survival without celebration. The candles I didn't light. The wishes I didn't make. Maybe that's what getting older is: learning to be okay with the quiet.
```

**Work Type**: `personalEssayReflection`  
**Expected Behavior**:
- Dialogue = **NA** → No score, no "add dialogue" suggestions
- Conflict = **NA** → No score, no "increase conflict" suggestions
- Hook, Voice, Theme, Line Polish = **R** → Scored normally

**Pass Criteria**:
- Output contains **no scores** for Dialogue/Conflict
- Output contains **no revision directives** mentioning dialogue/conflict (e.g., "add dialogue," "needs external conflict")
- Output contains **no WAVE flags** for "missing dialogue tags" or "conflict escalation"
- Output **does** contain scores and commentary for Hook, Voice, Theme, Line Polish

### Fixture 2: Memoir Vignette

**Work Type**: `memoirVignette`  
**Expected Behavior**:
- Dialogue = **NA** → No score, no suggestions
- Conflict = **O** → May be scored/commented, but **never required**
- Worldbuilding = **O** → May be scored/commented, but **never required**

**Pass Criteria**:
- Output contains **no score** for Dialogue
- If Conflict/Worldbuilding are mentioned, commentary must use **optional framing** (e.g., "Consider adding..." not "Must add...")
- No revision directives using **must/should/needs** language for Optional criteria

---

## Enforcement Checklist

Before deploying any changes to the evaluation engine, verify:

- [ ] `detectWorkType.js` returns detection + confidence, requires user confirmation
- [ ] `validateWorkTypeMatrix.js` enforces full coverage (13 criteria per Work Type)
- [ ] `evaluateQuickSubmission.js` builds `criteriaPlan` from matrix, enforces NA prohibition in LLM prompt
- [ ] Post-processing nullifies NA scores and filters NA-related revision requests
- [ ] Acceptance fixtures pass (no NA scoring, no NA suggestions)
- [ ] Audit events log `final_work_type_used`, `detected_work_type`, `user_action`

---

## Risk Control: What Could Go Wrong

### Risk 1: "Helpful" Heuristics Override User Intent
**Scenario**: Detection logic sees high first-person density → quietly routes to memoir → scores dialogue as missing  
**Mitigation**: Intent supremacy rule (Section 3) + audit trail (`user_action`, `final_work_type_used`)

### Risk 2: LLM Ignores NA Instructions
**Scenario**: LLM prompt says "don't score Dialogue," but LLM generates dialogue suggestions anyway  
**Mitigation**: Post-processing (lines 407-447 in `evaluateQuickSubmission.js`) nullifies scores + filters revision requests

### Risk 3: Incomplete Matrix Coverage
**Scenario**: New Work Type added without defining all 13 criteria  
**Mitigation**: Fail-fast validation in `validateWorkTypeMatrix.js` blocks evaluation if coverage is incomplete

### Risk 4: Craft Guidance Treated as Law
**Scenario**: "Reflective prose uses interior monologue" gets encoded as a rule, causing evaluations to penalize dialogue in essays  
**Mitigation**: This document (Section: Non-Binding Guidance) explicitly labels style observations as non-enforceable

---

## Glossary

- **Work Type**: A canonical format (e.g., personalEssayReflection, novelChapter) with defined applicability rules.
- **Criteria Plan**: Per-evaluation object that defines which criteria are R/O/NA/C for the current Work Type.
- **NA (Not Applicable)**: Hard prohibition—criterion must not be evaluated, scored, or mentioned.
- **Intent Supremacy**: User-confirmed Work Type always takes precedence over detection heuristics.
- **Acceptance Fixture**: Test case with defined input, expected Work Type, and pass/fail criteria.

---

## References

- **MDM Canon v1.0.0**: Embedded master data in `detectWorkType.js`, `validateWorkTypeMatrix.js`
- **Acceptance Tests**: `functions/testWorkTypeRouting.js`
- **Audit Schema**: `EvaluationAuditEvent` entity