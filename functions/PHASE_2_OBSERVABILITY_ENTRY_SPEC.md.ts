# PHASE 2 ENTRY SPEC — OBSERVABILITY & LEARNING
## Isolation-Safe Canon (v1.0)

**Status:** DRAFT — READY TO FREEZE UPON PHASE 1 FORMAL CLOSURE  
**Depends On:** Phase 1 marked Structurally Closed / Operationally Pending  
**Scope:** Observability only (read-only with respect to runtime enforcement)  

---

## 1. Purpose

Phase 2 introduces **visibility, measurement, and learning** without changing system behavior.

It answers **one question only:**
> "What is happening, how often, and why?"

It **must never answer:**
- "What should the system do differently?"
- "Can we relax enforcement?"
- "Can we override gates?"

---

## 2. Non-Negotiable Isolation Rule

**Phase 2 may observe truth, but may not participate in it.**

This means:

### No Phase 2 component may:
- Modify enforcement logic
- Alter thresholds
- Affect eligibility
- Change outputs
- Influence LLM invocation
- Gate or unblock execution

**Phase 2 components are strictly downstream consumers of Phase 1 artifacts and audits.**

Any attempt to modify runtime behavior via observability is a **governance violation requiring a CCR**.

---

## 3. Allowed Data Sources (Read-Only)

Phase 2 may read **only** from the following canonical artifacts:
- `EvaluationRun`
- `EvaluationSegment`
- `EvaluationGateDecision`
- `EvaluationSpineSynthesis`
- `matrixPreflight` audit logs
- Canonical endpoint audit envelopes

### Explicitly Forbidden:
❌ Raw manuscript text  
❌ Handler-internal variables  
❌ Transient in-memory state  
❌ UI-only derived values  

---

## 4. Phase 2 Components (Permitted)

### 4.1 Control Tower Dashboards

**Read-only dashboards showing:**
- Request volume by endpoint
- Governance allow/block rates
- Gate pass/fail distributions
- Confidence score distributions
- Provenance mode usage (artifact-backed vs manual)

**Dashboards must never:**
- Trigger re-evaluation
- Suggest overrides
- Alter UI eligibility

### 4.2 Incident Tracking (RCA)

Phase 2 may introduce:
- `Incident` entity (read-only correlation)
- Links to:
  - Audit records
  - Run IDs
  - Policy versions

**Incident workflow may document:**
- What happened
- When
- Impact
- Mitigation steps

**It may not:**
- Retroactively alter records
- Invalidate prior results
- Suppress outputs

### 4.3 SLA / SLO Measurement

Phase 2 may measure:
- Latency
- Throughput
- Error rates
- MTTR

**SLA visibility is observational only.**  
Violations may be reported but **not enforced automatically**.

### 4.4 Confidence Distribution Analysis

Phase 2 may compute:
- Score histograms
- Drift over time
- False-certainty indicators (descriptive only)

**Phase 2 may not:**
- Adjust confidence caps
- Re-weight criteria
- Alter scoring formulas

Those actions require **Phase 3 calibration + CCR**.

---

## 5. Output Surfaces (Strictly Informational)

### Phase 2 may expose:
- Dashboards
- Reports
- Internal analytics views

### Phase 2 may not expose:
❌ New user-facing outputs  
❌ Modified evaluation results  
❌ Alternative scores  

If a Phase 2 view appears user-visible, it must be explicitly labeled:  
**"Observational — Non-Actionable."**

---

## 6. Phase Boundary Enforcement

### Phase 2 is blocked from:
❌ Calling `matrixPreflight`  
❌ Invoking LLMs  
❌ Triggering evaluations  
❌ Writing to `Evaluation*` entities  

### Phase 2 may:
✅ Read  
✅ Aggregate  
✅ Visualize  
✅ Export metrics  

---

## 7. Change Control

Any proposal to:
- Use Phase 2 signals to alter runtime behavior
- Auto-tune thresholds
- Suppress or override gates

**Requires:**
1. Phase 3 calibration evidence
2. Approved CCR
3. Canon version increment

**No exceptions.**

---

## 8. Acceptance Criteria for Phase 2 Start

Phase 2 may begin **only when:**
1. Phase 1 is formally closed via exit tests
2. Phase 1 canon is frozen
3. CCR protocol is active
4. Observability code paths are read-only by design

---

## 9. Phase 2 Completion Definition (Preview)

Phase 2 is considered complete when:
- Dashboards are live
- Incident workflow is active
- SLA metrics are visible
- Confidence distributions are tracked over time
- **No Phase 1 invariants were violated**

---

## 10. Final Canon Statement (Lock This)

**Phase 2 may reveal truth, but may never create it.**  
**Enforcement belongs to Phase 1.**  
**Change belongs to Phase 3.**

---

## What This Gives You

✅ Phase 1: Frozen and protected  
✅ Phase 2: Defined, isolated, and safe  
✅ Phase 3: Reserved exclusively for empirical change  
✅ CCR: The only legal bridge between phases  

This is a textbook-clean lifecycle.

---

**Phase 2 Status:** ✅ SPEC FROZEN / ⏸️ START BLOCKED ON PHASE 1 CLOSURE  
**Isolation Guarantee:** Read-only by design