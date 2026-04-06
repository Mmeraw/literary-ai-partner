# Jira Epic: Diagnostics Dashboard — Evidence-Backed Revision Readiness

**Epic ID:** RG-DIAG-001  
**Status:** Ready for Implementation  
**Priority:** High (Competitive Parity + Differentiation)

---

## Epic Description

Implement a read-only Diagnostics Dashboard that surfaces quantitative manuscript metrics using existing WAVE validators and audit events. Diagnostics must gate all Revise actions and provide traceable evidence for every critique surfaced in Evaluate.

This epic formalizes parity with AutoCrit / ProWritingAid diagnostics while enabling RevisionGrade's core differentiators: canon enforcement, auditability, and intent-aware revision.

---

## Scope

### In Scope
- ✅ Metrics dashboard (read-only)
- ✅ Evidence linkage to validators and audit events
- ✅ Revision readiness gating
- ✅ Phase-based rollout (Parity → Differentiation)

### Out of Scope
- ❌ Grammar correction
- ❌ Inline rewriting
- ❌ Free-form AI suggestions
- ❌ UI cloning of competitor tools

**Scope Constraint:**  
UI, data contracts, and gating rules only; uses existing WAVE, EvaluationAuditEvent, and OutputVersion primitives with no new backend services.

---

## Acceptance Criteria (Must Pass All)

### 1. Diagnostics Execution
- [ ] Diagnostics auto-runs on Evaluate submission
- [ ] Diagnostics persists results per OutputVersion
- [ ] No Revise action allowed unless diagnostics completed

### 2. Metrics Rendering
The following metrics must render deterministically (no LLM generation):
- [ ] Sentence length distribution
- [ ] Paragraph density
- [ ] Readability score (reference only)
- [ ] Dialogue vs exposition ratio
- [ ] Repeated word / phrase frequency
- [ ] Adverb density
- [ ] Passive voice density
- [ ] Scene / section length variance

### 3. Evidence Requirements
- [ ] Every warning or flag displays an Evidence Badge
- [ ] Evidence Badge links to:
  - WAVE validator ID
  - Affected segment IDs
  - AuditEvent timestamp
- [ ] No critique without evidence linkage

### 4. Revision Gating
- [ ] Revise blocked if diagnostics missing
- [ ] Revise blocked if canon drift exceeds threshold
- [ ] Override requires explicit confirmation and is logged

### 5. Auditability
- [ ] All diagnostics results reproducible from logs
- [ ] All overrides recorded in EvaluationAuditEvent
- [ ] No silent failures

---

## Done When

✅ QA can reproduce every metric from stored events  
✅ Revise is impossible without diagnostics  
✅ Canon drift is surfaced before rewriting  
✅ No UI element claims interpretation without evidence

---

## Test Cases

### Test 1: Diagnostics Auto-Execution
**Given:** User submits manuscript to Evaluate  
**When:** Evaluation completes  
**Then:** Diagnostics runs automatically and stores results in EvaluationAuditEvent

### Test 2: Evidence Linkage
**Given:** Diagnostics displays "High adverb density" warning  
**When:** User clicks Evidence Badge  
**Then:** Modal shows:
- Validator ID (e.g., WAVE_ADVERB_DENSITY)
- Affected segments with line numbers
- AuditEvent timestamp

### Test 3: Revise Gating (Hard Block)
**Given:** Diagnostics has not been run  
**When:** User clicks Revise button  
**Then:** Button is disabled with tooltip "Run diagnostics first"

### Test 4: Revise Gating (Soft Block with Override)
**Given:** Diagnostics shows canon drift warning  
**When:** User clicks Revise button  
**Then:** Override modal appears requiring confirmation and reason logging

### Test 5: Reproducibility
**Given:** Diagnostics shows "Sentence length variance: 12.4 words"  
**When:** QA queries EvaluationAuditEvent for that manuscript  
**Then:** Raw sentence length data matches displayed metric

### Test 6: No Silent Failures
**Given:** WAVE validator fails during diagnostics  
**When:** Diagnostics completes  
**Then:** Error is logged in EvaluationAuditEvent and surfaced in UI with specific failure reason

---

## Implementation Phases

### Phase 1: Parity (Sprint 1-3)
**Goal:** Match AutoCrit/ProWritingAid diagnostic expectations

**Deliverables:**
- Overall Revision Score
- Category Tiles Grid (13 criteria)
- Core, Repeats, Structure tabs
- Evidence Badges
- Revision Readiness Gating

**Success Metric:** Users say "This feels professional, like AutoCrit"

---

### Phase 2: Differentiation (Sprint 4+)
**Goal:** Add features competitors can't match

**Deliverables:**
- Canon Drift Score (fully wired)
- Intent Alignment scoring
- Progress Over Time visualization
- Genre baseline comparisons

**Success Metric:** Users say "This is the only tool that protects my voice"

---

## Dependencies

### Technical Dependencies
- WAVE validators (existing)
- EvaluationAuditEvent entity (existing)
- OutputVersion entity (existing)
- Manuscript/Chapter entities (existing)

### Cross-Team Dependencies
- QA team: Test case execution
- Design: UI mockups for dashboard layout
- Documentation: User-facing diagnostic explanations

---

## Risk & Mitigation

### Risk 1: Metrics calculation too slow
**Impact:** Dashboard load > 2 seconds  
**Mitigation:** Pre-compute metrics during Evaluate, store in EvaluationAuditEvent

### Risk 2: Users bypass gating
**Impact:** Revise happens without diagnostics  
**Mitigation:** Hard block at API level, not just UI

### Risk 3: Evidence linkage incomplete
**Impact:** Users don't trust critiques  
**Mitigation:** QA checklist requires 100% evidence coverage before launch

---

## Related Documents

- `DIAGNOSTICS_DASHBOARD_SPECIFICATION.md` — Full technical spec
- `DASHBOARD_ANALYTICS_RELIABILITY_CONTRACT.md` — Separate analytics dashboard
- `GOVERNANCE_EPIC_RG-EVAL-001.md` — WAVE validator definitions
- `EVALUATE_QA_CHECKLIST.md` — QA enforcement standards

---

## Sign-Off Required

**Engineering:** [ ]  
**QA:** [ ]  
**Product:** [ ]  
**Documentation:** [ ]

---

**END OF EPIC**