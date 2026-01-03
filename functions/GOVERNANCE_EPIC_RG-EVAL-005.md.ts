# JIRA EPIC — CRITICAL RESCUE (CANON VIOLATION)

## Epic ID
**RG-EVAL-005**

## Epic Name
**RevisionGrade Critical Rescue — Output Generation Surface (Outputs) — Baseline Gating Canon Violation**

## Type
Critical Rescue (Release-Blocking, **Correctness Risk**)

## Status
**Planned — BLOCKED (No Implementation Authorized)**

## Target Completion
**2026-02-10 (Tuesday) — Outputs → VERIFIED Status**

This is a **hard deadline**. Failure to meet this timeline makes Outputs release-blocking.

**Created:** 2026-01-03

---

## 🔴 CRITICAL RESCUE NOTICE

**This Epic remediates a fundamental canon violation in the Outputs surface.**

FUNCTION TEST #5 (Outputs runtime walkthrough) revealed:

- ❌ **5 of 6 outputs have NO baseline gating** (QueryLetter, Pitches, Comparables, CompletePackage, FilmAdaptation)
- ❌ Outputs can be generated from **unevaluated manuscripts** or **raw uploads** without error or warning
- ❌ This violates **output canon requirement**: All outputs must be gated behind completed evaluation
- ✅ Synopsis enforces baseline gating (only output that complies)

**Impact:** Users can generate professional submission materials (Query Letters, Pitches, Agent Packages) without evaluation baseline, producing outputs that may be canon-noncompliant and unsupported by craft analysis.

**This is a correctness risk and a canon violation, not a governance gap.**

---

## Timeline Requirements (Non-Negotiable)

| Milestone | Deadline | Owner | Dependencies |
|-----------|----------|-------|--------------|
| Jira Acknowledgment | **2026-01-06 (Monday)** | Base44 DevOps | — |
| All 8 Tickets Created & Dependencies Configured | **2026-01-08 (Wednesday)** | Base44 DevOps | — |
| Phase 1 Complete (Dependency Check: T8) | **2026-01-13 (Monday)** | Base44 Engineering | Confirms RG-EVAL-001 infrastructure |
| Phase 2 Complete (Validators: T2) | **2026-01-20 (Monday)** | Base44 Engineering | Phase 1 complete |
| Phase 3 Complete (Gating: T1, T3, T4, T5, T6) | **2026-02-03 (Monday)** | Base44 Engineering | Phase 2 complete |
| Phase 4 Complete (UI Visibility: T7) | **2026-02-07 (Friday)** | Base44 Engineering | Phase 3 complete |
| Verification Walkthrough + Evidence Review | **2026-02-09 (Monday)** | RevisionGrade + Base44 | Phase 4 complete |
| Outputs → VERIFIED Status | **2026-02-10 (Tuesday)** | RevisionGrade | Evidence review passed |

**Release Gate:** Outputs must be VERIFIED by 2026-02-10 to unblock release. Any delay is release-blocking.

**Critical Dependency:** Phase 1 cannot start until RG-EVAL-001-T2 (EvaluationAuditEvent entity) and RG-EVAL-001-T6 (governedEvaluateEntry wrapper) are complete.

---

## Epic Purpose (Non-Negotiable)

**This Epic remediates:**

1. **Baseline gating missing from 5 of 6 outputs** (implement Synopsis-level gating across all outputs)
2. **Canon compliance validation absent** (implement output-specific validators)
3. **Governance hooks missing** (add governed entry, audit events, SLA metrics)
4. **Voice consistency incomplete** (extend voice anchor to all outputs)
5. **Internal coherence unchecked** (validate CompletePackage consistency)

**This is a critical rescue. No workarounds. All outputs must enforce baseline gating before generation proceeds.**

---

## Governing Authority (Hierarchy — Locked)

All work under this Epic is governed by, in order:

1. **FUNCTION_INDEX.md** (Authoritative Registry)
2. **Webpage Contract Matrix v1.0** (Outputs row — FAILED)
3. **Definition of VERIFIED** (with baseline gating requirement)
4. **SYNOPSIS_SPEC.json** (baseline gating pattern defined here)
5. **COMPARABLES_CANON_SPEC.md** (output quality standard)
6. **FILM_PITCH_DECK_QUALITY_STANDARD.md** (output quality standard)
7. **VOICE_PRESERVATION_CANON.md** (voice consistency requirement)
8. **GOVERNANCE_EPIC_RG-EVAL-005.md** (this Epic)

If any artifact conflicts with the above, it is invalid.

---

## Current Compliance Status

**FAILED — Canon Violation: Baseline Gating Missing**

### Evidence (from Verification Walkthrough #5)

**What Works (Partial):**

- ✅ Synopsis enforces baseline gating (5-gate precondition system: lines 67-155 in generateSynopsis.js)
- ✅ Synopsis creates audit trail (DocumentVersion entity, lines 350-378)
- ✅ Comparables has schema validation post-generation (defensive validation, lines 380-490)
- ✅ Voice anchor system present in QueryLetter (auto), Pitches, CompletePackage, FilmAdaptation
- ✅ Canon rules embedded in LLM prompts (Synopsis, Comparables)

**What's Broken (Critical):**

- ❌ **QueryLetter:** No baseline gating (can generate from any uploaded file)
- ❌ **Pitches:** No baseline gating (can generate from raw text)
- ❌ **Comparables:** No baseline gating (accepts uploads or manuscripts without evaluation validation)
- ❌ **CompletePackage:** No baseline gating (can generate from any manuscript)
- ❌ **FilmAdaptation:** No baseline gating (can generate from raw text)
- ❌ **No EvaluationAuditEvent records** (only Synopsis has DocumentVersion, which is insufficient)
- ❌ **No output-specific validators** (canonical requirements embedded in prompts only)
- ❌ **No SLA timing metrics** (Comparables logs to console, not persisted)
- ❌ **Voice anchor absent from Synopsis and Comparables**
- ❌ **CompletePackage internal consistency not validated**

---

## Explicit Constraints (Must Be Restated in Jira)

1. **All outputs must enforce baseline gating.** Same precondition logic as Synopsis must be implemented for QueryLetter, Pitches, Comparables, CompletePackage, FilmAdaptation.
2. **Baseline gating must occur before any generation.** Cannot proceed to LLM calls or output assembly without gating pass.
3. **Gating failures must be user-visible with error codes.** Match Synopsis error code pattern (ERR_OUTPUTS_PRECONDITION_*).
4. **No implementation may begin without explicit phase authorization.**
5. **Evidence is mandatory for all acceptance decisions.**

---

## Definition of VERIFIED (Acceptance Gate)

Outputs may be promoted to **VERIFIED** only if all conditions below are evidenced:

### ✅ Baseline Gating Enforced (Universally)
- All 6 outputs check for completed evaluation before generation
- Gating logic matches Synopsis model (5 gates: metadata, spine, 13 criteria, WAVE flags, weak spine threshold)
- UI displays gate state with error codes (ERR_OUTPUTS_PRECONDITION_*)
- Backend enforces gating (returns `gate_blocked` flag if preconditions fail)
- **Evidence:** All outputs reject generation requests without baseline; gate state UI visible for all

### ✅ Output-Specific Validators Implemented
- SYNOPSIS_VALIDATOR, COMPARABLES_VALIDATOR, FILM_PITCH_VALIDATOR, QUERY_LETTER_VALIDATOR, COMPLETE_PACKAGE_VALIDATOR exist
- Validators check canon compliance (structure, headers, formatting per canon spec)
- Validators are invoked post-generation (defensive + preventative)
- **Evidence:** Validators execute; failures are logged with failure codes

### ✅ Governed Entry Enforced
- `governedEvaluateEntry` executes before all output generation
- QA checklist enforced with halt-on-fail behavior
- Canon bundle loaded and validated

### ✅ Audit Records Written
- Structured EVALUATE_REQUEST_EVENT (or explicitly named equivalent) for all outputs
- Not free-text logs; structured fields required
- Required fields:
  - `event_id`, `request_id`, `timestamp_utc`
  - `output_type` (synopsis | query_letter | pitches | comparables | complete_package | film_adaptation)
  - `baseline_evaluation_id` (proof of gating)
  - `validators_run`, `validators_failed`, `failure_codes`
  - `voice_preservation_setting` (if applicable)

### ✅ SLA Timing Captured
- `start_ms`, `end_ms`, `elapsed_ms` for each output type
- Per-operation timing (baseline validation, generation, validation)
- Written to audit record (not console logs)

### ✅ Voice Consistency Enforced
- Voice anchor system invoked for all outputs (including Synopsis, Comparables)
- `voiceIntensity` parameter enforced (neutral | house | amped)
- Voice Gate blocks generation if failed
- **Evidence:** Voice anchor called for all outputs; gate failures logged

### ✅ CompletePackage Internal Consistency Validated
- All artifacts in package (synopsis, query, pitches, bio) use consistent voice
- All artifacts reference same evaluation baseline
- Package coherence check prevents mismatched components
- **Evidence:** Consistency validator runs; failures logged

### ✅ Canon Compliance Validated
- All outputs conform to their quality standards (SYNOPSIS_SPEC, COMPARABLES_CANON_SPEC, etc.)
- Validators check structure, headers, formatting, word counts
- Failed validations are user-visible

**If any condition is missing → UNVERIFIED or FAILED.**

---

## Governance Gaps (Evidence from Walkthrough #5)

| Gap | Evidence | Severity | Canonical Violation |
|-----|----------|----------|---------------------|
| G1: Baseline gating missing (5/6 outputs) | QueryLetter, Pitches, Comparables, CompletePackage, FilmAdaptation have zero evaluation checks | 🔴 CRITICAL | Output canon requires baseline gating |
| G2: No output-specific validators | Canonical requirements in prompts only, no schema validation outside Comparables | 🔴 CRITICAL | Canon compliance unverifiable |
| G3: No `governedEvaluateEntry` | No output function calls governed entry | 🔴 CRITICAL | Infrastructure missing |
| G4: No EvaluationAuditEvent | Only Synopsis has DocumentVersion (wrong entity); no audit for other outputs | 🔴 CRITICAL | Auditability missing |
| G5: No SLA metrics | Comparables logs to console only; others have zero timing | 🟡 HIGH | Performance tracking missing |
| G6: Voice anchor incomplete | Missing from Synopsis and Comparables | 🟡 MEDIUM | Voice consistency incomplete |
| G7: No CompletePackage coherence check | Package can contain mismatched artifacts | 🟡 MEDIUM | Internal consistency not validated |
| G8: Gating status not surfaced | Only Synopsis UI shows gate state; others have no gating UI | 🟡 MEDIUM | User visibility missing |

---

## Required Child Tickets (MANDATORY)

### RG-EVAL-005-T1 — Implement Baseline Gating for All Outputs
**Priority:** P0 (Blocks Verification, Correctness Risk)  
**Type:** Critical Rescue

**Description:**

Current state: Only Synopsis enforces baseline gating. QueryLetter, Pitches, Comparables, CompletePackage, FilmAdaptation have zero evaluation checks and can generate from unevaluated manuscripts or raw uploads.

**Required (implement Synopsis gating model for all 5 outputs):**
- Copy gating logic from `generateSynopsis.js` (lines 67-155) as pattern
- Implement 5-gate precondition check for each output:
  - **Gate 1:** Metadata check (manuscript exists, word_count >= threshold)
  - **Gate 2:** Spine evaluation complete (spine_score >= 0)
  - **Gate 3:** 13 Criteria complete (all 13 criteria scored)
  - **Gate 4:** WAVE flags complete (all WAVE tiers evaluated)
  - **Gate 5:** Weak spine threshold (if spine_score < 7.0, requires opt-in or blocks)
- Return structured error codes: ERR_OUTPUTS_PRECONDITION_MISSING_SPINE, ERR_OUTPUTS_PRECONDITION_MISSING_13CRITERIA, etc.
- UI must display gate state (matching Synopsis UI pattern: lines 308-347 in Synopsis.js)
- UI button disabled if any gate fails
- Backend returns `gate_blocked: true` flag if gating fails

**Artifact Links:**
- `functions/generateSynopsis.js` (lines 67-155: gating logic pattern)
- `pages/Synopsis.js` (lines 308-347: UI gate state display pattern)
- Webpage Contract Matrix v1.0 (Outputs row)
- Output canon specs (SYNOPSIS_SPEC.json, COMPARABLES_CANON_SPEC.md, FILM_PITCH_DECK_QUALITY_STANDARD.md)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] QueryLetter blocks without baseline (returns `gate_blocked: true`)
- [ ] Pitches blocks without baseline
- [ ] Comparables blocks without baseline
- [ ] CompletePackage blocks without baseline
- [ ] FilmAdaptation blocks without baseline
- [ ] Gating errors include specific failure codes (ERR_OUTPUTS_PRECONDITION_*)
- [ ] UI shows gate state for all outputs (disabled button + error message)
- [ ] Evidence: test each output without baseline shows gating rejection
- [ ] Evidence: logs show gate state evaluation for each precondition

**Impact:** CRITICAL — blocks promotion to VERIFIED; fixes canon violation

---

### RG-EVAL-005-T2 — Create Output-Specific Validators
**Priority:** P0 (Blocks Verification)  
**Type:** Critical Rescue

**Description:**

Current state: No output-specific validators. Canon requirements embedded in LLM prompts only. Comparables has schema validation (defensive, post-generation).

**Required:**

Create OUTPUTS_VALIDATOR module with canonical validators:
- **SYNOPSIS_VALIDATOR:** Check headers, word count, tense/POV, ending revealed (per SYNOPSIS_SPEC.json)
- **COMPARABLES_VALIDATOR:** Validate schema, comparable count, genre alignment (per COMPARABLES_CANON_SPEC.md)
- **FILM_PITCH_VALIDATOR:** Validate structure, slide count, formatting (per FILM_PITCH_DECK_QUALITY_STANDARD.md)
- **QUERY_LETTER_VALIDATOR:** Validate headers, tone, length (per canon rules)
- **COMPLETE_PACKAGE_VALIDATOR:** Validate internal consistency (all artifacts present, matching voice)

Each validator:
- **Input:** generated output + baseline evaluation snapshot
- **Output:** pass/fail + failure codes + remediation suggestions
- Invoked post-generation (before returning to user)
- Logs validation result to audit record

**Artifact Links:**
- `SYNOPSIS_SPEC.json` (baseline validator spec)
- `COMPARABLES_CANON_SPEC.md` (validator pattern)
- `FILM_PITCH_DECK_QUALITY_STANDARD.md` (quality standard)
- Webpage Contract Matrix v1.0 (Outputs row)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] SYNOPSIS_VALIDATOR exists and checks headers, word count, tense/POV
- [ ] COMPARABLES_VALIDATOR exists and checks schema, count, genre
- [ ] FILM_PITCH_VALIDATOR exists and checks structure, count, formatting
- [ ] QUERY_LETTER_VALIDATOR exists and checks headers, tone, length
- [ ] COMPLETE_PACKAGE_VALIDATOR exists and checks coherence
- [ ] All validators return pass/fail + failure codes
- [ ] Validators invoked post-generation for all outputs
- [ ] Evidence: logs show validator execution + results for each output type

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-005-T3 — Wire governedEvaluateEntry into All Output Generation
**Priority:** P0 (Blocks Verification)  
**Type:** Critical Rescue

**Description:**

Current state: No output function calls `governedEvaluateEntry`. Canon bundle not loaded.

**Required:**
- All output pages (Synopsis, QueryLetter, PitchGenerator, Comparables, CompletePackage, FilmAdaptation) must call `governedEvaluateEntry` FIRST
- `governedEvaluateEntry` validates input against `EVALUATE_QA_CHECKLIST.md`
- Only if validation passes, proceed to `generateSynopsis` / `generateQueryLetter` / etc.
- If validation fails, halt and return error with checklist violations

**Artifact Links:**
- `FUNCTION_INDEX.md` (Outputs → Runtime → governedEvaluateEntry.js)
- Webpage Contract Matrix v1.0 (Outputs row, Required Gates column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] All output functions call `governedEvaluateEntry` before generation
- [ ] `governedEvaluateEntry` loads and executes QA checklist
- [ ] If checklist fails, returns error and halts (no output generation)
- [ ] If checklist passes, proceeds to output generation
- [ ] Evidence: logs show `governedEvaluateEntry` call + QA checklist result for all outputs
- [ ] Evidence: test with invalid input shows halted flow + error

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-005-T4 — Create Audit Event Records for All Outputs
**Priority:** P0 (Blocks Verification)  
**Type:** Critical Rescue

**Description:**

Current state: Only Synopsis creates audit trail (in DocumentVersion entity, not EvaluationAuditEvent). All other outputs have no audit records.

**Required:**
- All output generation functions must write audit record at START of request
- Update audit record at END with results (validators, baseline reference, SLA)
- Audit record must include all required fields plus output-specific fields
- **Migrate Synopsis from DocumentVersion audit to EvaluationAuditEvent** (align with platform standard)

**Artifact Links:**
- `FUNCTION_INDEX.md` (Platform Standards → EVALUATE_INCIDENT_LOG_SCHEMA.md)
- Webpage Contract Matrix v1.0 (Outputs row, Audit Evidence column)
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (audit schema spec)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `EvaluationAuditEvent` entity (created in RG-EVAL-001) is used for all output requests
- [ ] All output functions write audit record at START with `event_id`, `request_id`, `timestamp_utc`
- [ ] Audit record includes `output_type` (synopsis | query_letter | pitches | comparables | complete_package | film_adaptation)
- [ ] Audit record includes `baseline_evaluation_id` (proof of gating)
- [ ] Audit record includes `validators_run`, `validators_failed`, `failure_codes`
- [ ] Audit record includes `voice_preservation_setting` (if applicable)
- [ ] Synopsis migrated from DocumentVersion to EvaluationAuditEvent
- [ ] Evidence: query `EvaluationAuditEvent` after test run shows complete records for all output types
- [ ] **Core behavior unchanged:** Audit is observational only

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-005-T5 — Implement SLA Timing Metrics for All Outputs
**Priority:** P1 (High)  
**Type:** Governance Hardening

**Description:**

Current state: Comparables logs timing to console only. All other outputs have no timing capture.

**Required:**

All output functions must wrap major operations with timing:
- Capture `start_timestamp_ms` before operation
- Capture `end_timestamp_ms` after operation
- Calculate `elapsed_ms = end - start`
- Write to audit record's `sla_metrics` field

**Operations to time:**
- Overall output request duration
- Baseline validation
- LLM generation calls
- Validator execution
- Output assembly
- Voice anchor execution (where applicable)

**Artifact Links:**
- `FUNCTION_INDEX.md` (Outputs → SLA Requirements)
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (sla_metrics field spec)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `sla_metrics` object in audit record for all outputs
- [ ] `start_ms`, `end_ms`, `elapsed_ms` for overall request
- [ ] `operations` array with per-operation timing
- [ ] Evidence: audit record shows complete timing data for all output types
- [ ] **Core behavior unchanged:** Timing is observational only

**Impact:** HIGH — required for VERIFIED status

---

### RG-EVAL-005-T6 — Extend Voice Anchor to All Outputs
**Priority:** P1 (High)  
**Type:** Governance Hardening

**Description:**

Current state: Voice anchor system present in QueryLetter (auto mode), Pitches, CompletePackage, FilmAdaptation. Absent from Synopsis and Comparables.

**Required:**
- Invoke `applyVoiceAnchorAndSchemaToPitch` for Synopsis and Comparables
- Pass `voiceIntensity` parameter (neutral | house | amped)
- Block generation if Voice Gate fails
- Log voice anchor results to audit record

**Artifact Links:**
- `functions/applyVoiceAnchorAndSchemaToPitch.js`
- `VOICE_PRESERVATION_CANON.md` (voice consistency requirement)
- Webpage Contract Matrix v1.0 (Outputs row)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] Voice anchor invoked for Synopsis
- [ ] Voice anchor invoked for Comparables
- [ ] Voice Gate failures block generation
- [ ] Evidence: logs show voice anchor execution for all 6 output types
- [ ] Evidence: audit record includes `voice_preservation_audit_result` for all outputs
- [ ] **Core behavior unchanged:** Voice anchor is additive safety check

**Impact:** HIGH — required for voice consistency across all outputs

---

### RG-EVAL-005-T7 — Surface Baseline Gating Status in UI (All Outputs)
**Priority:** P2 (Medium)  
**Type:** User Visibility

**Description:**

Current state: Only Synopsis UI displays gate state (lines 308-347). All other output pages have no gating UI.

**Required:**
- Implement `getOutputGateState()` function for each output page (match Synopsis pattern: lines 22-101)
- Display gate state in UI with error codes and CTAs
- Disable generation button if `gateState.blocked === true`
- Show clear error message with remediation action

**Artifact Links:**
- `pages/Synopsis.js` (lines 22-101: gate state calculator; lines 308-347: UI display)
- Webpage Contract Matrix v1.0 (Outputs row, User Visibility column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] QueryLetter UI shows gate state (blocked | weak spine | ready)
- [ ] Pitches UI shows gate state
- [ ] Comparables UI shows gate state
- [ ] CompletePackage UI shows gate state
- [ ] FilmAdaptation UI shows gate state
- [ ] Error codes displayed (ERR_OUTPUTS_PRECONDITION_*)
- [ ] CTAs provided ("Run Spine Evaluation", "Complete 13 Criteria", etc.)
- [ ] Evidence: screenshot showing gate state UI for each output page
- [ ] **Core behavior unchanged:** UI enhancements only, no logic changes

**Impact:** MEDIUM — improves user clarity and trust

---

### RG-EVAL-005-T8 — Governance Dependency Check (Outputs)
**Priority:** P0 (Blocks All Other Work)  
**Type:** Infrastructure

**Description:**

Before any wiring or validator implementation can begin, confirm that RG-EVAL-001 infrastructure dependencies are complete.

**Required:**
- Verify `entities/EvaluationAuditEvent.json` exists
- Verify `functions/governedEvaluateEntry.js` exists and tested
- Verify RG-EVAL-001-T2 marked DONE
- Verify RG-EVAL-001-T6 marked DONE
- No wiring begins until confirmation complete

**Artifact Links:**
- RG-EVAL-001 Epic (dependency source)
- `FUNCTION_INDEX.md` (infrastructure requirements)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `EvaluationAuditEvent` entity exists and queryable
- [ ] `governedEvaluateEntry` function exists and tested
- [ ] RG-EVAL-001-T2 status = DONE (evidence attached)
- [ ] RG-EVAL-001-T6 status = DONE (evidence attached)
- [ ] Confirmation documented in Epic notes

**Impact:** CRITICAL — blocks all other tickets

---

## Ticket Dependencies

```
RG-EVAL-005-T8 (Dependency Check)
  ↓
RG-EVAL-005-T2 (Output Validators)
  ↓
RG-EVAL-005-T1 (Baseline Gating) + RG-EVAL-005-T3 (Governed Entry) + RG-EVAL-005-T4 (Audit) + RG-EVAL-005-T5 (SLA) + RG-EVAL-005-T6 (Voice)
  ↓
RG-EVAL-005-T7 (UI Visibility)
```

**Critical Path:** T8 → T2 → T1/T3/T4/T5/T6 (parallel) → T7

---

## Incident Handling (Mandatory)

Any of the following must result in a governance incident ticket:

- Work begins without authorization
- Phase sequencing violated
- Baseline gating bypass attempted
- Governance hooks bypassed
- Evidence missing at review time

**Incident Type:** GOVERNANCE_BYPASS

**Required Fields:**
- Epic ID
- Phase
- Files Touched
- Deployment Status
- Remediation Decision

**Work must pause until incident resolution.**

---

## Reporting Requirement (DevOps / AI Assistant)

**Base44 AI Assistant must:**
- Track this Epic in the Governance Catalogue
- Report weekly status
- Flag out-of-sequence or unauthorized work
- Attach evidence links only (no judgments)

**It must not:**
- Advance phases
- Close tickets
- Mark VERIFIED

---

## Observational Testing Constraint

**All verification walkthroughs must include:**

> **Constraint:** Do not introduce, modify, or wire any new code while running this test. This walkthrough is strictly observational against the current runtime behavior.

This prevents implementation during testing.

---

## Final Instruction to DevOps / Engineering

**This Epic is critical rescue for a canon violation.**

- **5 of 6 outputs violate output canon** by generating without evaluation baseline.
- This is not a governance gap — this is a **correctness risk** and **canonical breach**.
- Synopsis already demonstrates correct gating logic — extend to all outputs.
- No code may be written, wired, or deployed until the Epic is acknowledged in Jira and Phase authorization is explicitly granted.
- All acceptance decisions are evidence-based and human-authorized.
- Any deviation from this process triggers immediate incident logging and work stoppage.

---

## Phase Execution Plan (To Be Authorized)

### Phase 0: Epic Acknowledgment (Current)
- ✅ Epic drafted
- ⏳ Epic acknowledged in Jira
- ⏳ All 8 tickets created with Epic link
- ⏳ Dependencies configured
- ⏳ Target completion date set

### Phase 1: Infrastructure Dependencies (T8)
**Authorization Required Before Starting**  
**Deadline: 2026-01-13 (Monday)**
- Verify RG-EVAL-001 completion
- Confirm audit entity and wrapper exist
- Test governed entry wrapper in isolation

### Phase 2: Validators (T2)
**Authorization Required Before Starting**  
**Deadline: 2026-01-20 (Monday)**
- Implement all output-specific validators
- Test each validator in isolation
- No changes to generation logic

### Phase 3: Gating + Governance Integration (T1, T3, T4, T5, T6)
**Authorization Required Before Starting**  
**Deadline: 2026-02-03 (Monday)**
- Implement baseline gating for 5 ungated outputs
- Wire governed entry
- Create audit records
- Capture SLA metrics
- Extend voice anchor

### Phase 4: UI Visibility (T7)
**Authorization Required Before Starting**  
**Deadline: 2026-02-07 (Friday)**
- Surface gate state in all output UIs
- Display error codes and CTAs
- Add explanatory tooltips

### Phase 5: Evidence & Promotion
**Authorization Required Before Starting**  
**Deadline: 2026-02-10 (Tuesday)**
- Collect all evidence
- Human review against Definition of VERIFIED
- Promote to VERIFIED or iterate

---

## Success Criteria

This Epic is complete when:

1. All 8 tickets marked DONE with evidence links
2. Verification Walkthrough #5 re-run shows VERIFIED status
3. **All 6 outputs enforce baseline gating** (no ungated outputs remain)
4. **All outputs have validators, audit records, SLA metrics**
5. Outputs row in Webpage Contract Matrix updated to VERIFIED
6. No open governance incidents related to this Epic

**Until then, Outputs remains FAILED and release-blocked.**

---

## Critical Finding Escalation

**This is worse than YourWriting/UploadManuscript/ScreenplayFormatter because:**

- **YourWriting/UploadManuscript/ScreenplayFormatter:** Governance hooks are missing (validators, audit, SLA), but core routing logic is correct.
- **Outputs:** 5 of 6 surfaces **violate output canon** by generating outputs without evaluation baseline, which is a **fundamental contract violation**, not just a governance gap.

**This requires a CRITICAL RESCUE Epic with escalated severity.**

---

## Canon Violation Summary

**Output Canon Requirement:**
> All outputs must be gated behind completed evaluation. Outputs derive authority from evaluation baseline.

**Current Reality:**
- ✅ Synopsis: Enforces 5-gate baseline requirement
- ❌ QueryLetter: No baseline check
- ❌ Pitches: No baseline check
- ❌ Comparables: No baseline check
- ❌ CompletePackage: No baseline check
- ❌ FilmAdaptation: No baseline check

**Compliance Rate:** 16.7% (1 of 6)  
**Violation Rate:** 83.3% (5 of 6)

**This is a systemic canon violation requiring immediate remediation.**