# PHASE 2 OBSERVABILITY & LEARNING
## Entry Spec (Canon-Ready, v1.0)

**Status:** READY TO FREEZE  
**Prerequisite:** Phase 1 marked Structurally Closed / Operationally Pending  
**Change Control:** Any deviation requires an approved CCR  

---

## 1. Purpose (Single Question Only)

Phase 2 exists to answer:
> "What is happening, how often, and why?"

It **must never answer:**
- "What should change?"
- "Can enforcement be relaxed?"
- "Can outputs be overridden?"

---

## 2. Non-Negotiable Isolation Rule

**Phase 2 may observe truth, but may not participate in it.**

Therefore, Phase 2 **cannot:**
- Modify enforcement or thresholds
- Influence eligibility or outputs
- Invoke LLMs
- Call `matrixPreflight`
- Write to `Evaluation*` entities
- Suppress, reorder, or reinterpret Phase 1 results

**Violations require a CCR and Phase 3 evidence.**

---

## 3. Allowed Data Sources (Read-Only)

Phase 2 may read **only** from:
- `EvaluationRun`
- `EvaluationSegment`
- `EvaluationGateDecision`
- `EvaluationSpineSynthesis`
- Canonical endpoint audit envelopes
- `matrixPreflight` audit logs

### Explicitly Forbidden:
❌ Raw manuscript text  
❌ Handler internals  
❌ Transient memory  
❌ UI-derived or recomputed values  

---

## 4. Phase 2 Components (Permitted)

### 4.1 Control Tower Dashboards (Read-Only)

**Dashboards may display:**
- Request volume by endpoint
- Allow / block rates
- Gate pass / fail distributions
- Confidence score distributions
- Provenance usage (artifact-backed vs manual)
- `policyVersion` adoption over time

**Dashboards must not:**
- Trigger re-evaluation
- Compute eligibility
- Alter UI decisions

### 4.2 Incident Tracking & RCA

Introduce an `Incident` entity for correlation only:
- Links to audit records, run IDs, policy versions
- Documents cause, impact, mitigation

**May not:**
- Alter historical records
- Invalidate results
- Hide or suppress outputs

### 4.3 SLA / SLO Measurement

**Measure and visualize:**
- Latency
- Throughput
- Error rates
- MTTR

**SLA breaches may be reported, not enforced.**

### 4.4 Confidence Distribution Analysis

**Compute descriptive analytics:**
- Histograms
- Drift over time
- False-certainty indicators (descriptive only)

**May not:**
- Adjust caps
- Reweight criteria
- Modify scoring formulas

(Those actions belong to Phase 3 with CCR.)

---

## 5. Output Surfaces (Informational Only)

### Phase 2 may expose:
- Internal dashboards
- Reports
- Analytics exports

### Must not expose:
❌ New user-facing outputs  
❌ Alternative scores  
❌ Modified evaluations  

Any user-visible Phase 2 view must be labeled:  
**"Observational — Non-Actionable."**

---

## 6. Phase Boundary Enforcement

### Blocked actions (hard):
❌ LLM invocation  
❌ Evaluation triggers  
❌ Gate overrides  
❌ Writes to `Evaluation*` entities  

### Allowed actions:
✅ Read  
✅ Aggregate  
✅ Visualize  
✅ Export metrics  

---

## 7. Change Control & Escalation

Any proposal to:
- Auto-tune thresholds
- Relax gates
- Suppress outputs based on metrics

**Requires:**
1. Phase 3 calibration evidence
2. Approved CCR
3. Canon version increment

**No exceptions.**

---

## 8. Phase 2 Start Criteria

Phase 2 may begin **only when:**
1. Phase 1 exit tests are executed and archived
2. Phase 1 canon is frozen
3. CCR protocol is active
4. Observability paths are read-only by design

---

## 9. Phase 2 Completion Definition (Preview)

Phase 2 is complete when:
- Control Tower dashboards are live
- Incident/RCA workflow is active
- SLA metrics are visible
- Confidence distributions are tracked longitudinally
- **No Phase 1 invariants are violated**

---

## 10. Final Canon Statement (Lock This)

**Phase 2 reveals behavior; it does not change it.**  
**Enforcement is Phase 1.**  
**Change is Phase 3.**

---

**Phase 2 Status:** ✅ CANON FROZEN / ⏸️ START BLOCKED ON PHASE 1 CLOSURE  
**Isolation Guarantee:** Read-only by design, CCR-enforced