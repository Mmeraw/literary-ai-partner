# JIRA EPIC — GOVERNANCE REMEDIATION (CRITICAL ESCALATION)

## Epic ID
**RG-EVAL-003**

## Epic Name
**RevisionGrade Governance & Verification — Convert Surface (ScreenplayFormatter) — Canon Enforcement**

## Type
Governance-Compliance Remediation (Release-Blocking, **Critical Escalation**)

## Status
**Planned — BLOCKED (No Implementation Authorized)**

## Target Completion
**2026-02-03 (Monday) — ScreenplayFormatter → VERIFIED Status**

This is a **hard deadline**. Failure to meet this timeline makes ScreenplayFormatter release-blocking.

**Created:** 2026-01-03

---

## 🔴 CRITICAL ESCALATION NOTICE

**This Epic enforces existing locked governance.**

SCREENPLAY_FORMATTER_GOVERNANCE.md (UX/Intake Canon) already defines:
- ✅ Single input model ("User pastes anything. System figures it out.")
- ✅ No user-facing mode selection
- ✅ Automatic format detection with routing table
- ✅ Confidence-based behavior (≥95% proceed silently; <95% proceed + note)
- ✅ Authority posture ("Sell judgment, not controls")

**The gap:** This governance exists but has no enforcement layer.

**ScreenplayFormatter contains implicit format detection heuristics** (line 24 in `formatScreenplay.js`) that silently route requests based on string matching (`contains('INT.') || contains('EXT.')?`), without:

- ❌ Validation (governance specifies structural inspection)
- ❌ Auditing (governance implies auditability)
- ❌ Confidence scoring (governance requires "≥95%" logic)
- ❌ Fallback behavior (governance specifies proceed + note)
- ❌ Classification taxonomy (governance specifies novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay)

**This creates a correctness risk:** A user's prose containing the words "INT." or "EXT." in dialogue can be silently misclassified and routed to the wrong pipeline, with no audit trail and no user awareness.

**Governance Response:** Implicit heuristics violate locked governance. All routing decisions must implement the governance-specified inspection logic, scored, logged, and auditable.

**This is not new design. This is compliance with existing canon.**

---

## Timeline Requirements (Non-Negotiable)

| Milestone | Deadline | Owner | Dependencies |
|-----------|----------|-------|--------------|
| Jira Acknowledgment | **2026-01-06 (Monday)** | Base44 DevOps | RG-EVAL-001 infrastructure in progress |
| All 8 Tickets Created & Dependencies Configured | **2026-01-08 (Wednesday)** | Base44 DevOps | — |
| Phase 1 Complete (Dependency Check: T8) | **2026-01-13 (Monday)** | Base44 Engineering | Confirms RG-EVAL-001-T2, T6 done |
| Phase 2 Complete (Format Detection: T1, T4) | **2026-01-20 (Monday)** | Base44 Engineering | Phase 1 complete |
| Phase 3 Complete (Core Hooks: T2, T3, T5, T6) | **2026-01-27 (Monday)** | Base44 Engineering | Phase 2 complete |
| Phase 4 Complete (UI & Compliance: T7) | **2026-01-31 (Friday)** | Base44 Engineering | Phase 3 complete |
| Verification Walkthrough + Evidence Review | **2026-02-02 (Monday)** | RevisionGrade + Base44 | Phase 4 complete |
| ScreenplayFormatter → VERIFIED Status | **2026-02-03 (Tuesday)** | RevisionGrade | Evidence review passed |

**Release Gate:** ScreenplayFormatter must be VERIFIED by 2026-02-03 to unblock release. Any delay is release-blocking.

**Critical Dependency:** Phase 1 cannot start until RG-EVAL-001-T2 (EvaluationAuditEvent entity) and RG-EVAL-001-T6 (governedEvaluateEntry wrapper) are complete.

---

## Epic Purpose (Non-Negotiable)

**This Epic enforces existing locked governance.**

SCREENPLAY_FORMATTER_GOVERNANCE.md (UX/Intake Canon) already defines:
- ✅ Single input model ("User pastes anything. System figures it out.")
- ✅ No user-facing mode selection  
- ✅ Automatic format detection with routing table
- ✅ Confidence-based behavior (≥95% proceed silently; <95% proceed + note)
- ✅ Authority posture ("Sell judgment, not controls")

**The gap:** This governance exists but has no enforcement layer.

FUNCTION TEST #3 revealed:
1. **Governance bypass** — No validators execute format detection or routing
2. **Silent routing heuristics** — Line 24 uses crude string matching, not governed inference
3. **No audit trail** — Format detection and routing decisions are unlogged
4. **No confidence scoring** — Binary logic with no fallback or escalation
5. **Undetectable misclassification risk** — Prose containing "INT." or "EXT." silently misrouted

**This Epic exists to wire the runtime enforcement layer (validators, audit, confidence) that makes the locked governance verifiable and auditable.**

This is not new design. This is compliance with existing canon.

---

## Governing Authority (Hierarchy — Locked)

All work under this Epic is governed by, in order:

1. **SCREENPLAY_FORMATTER_GOVERNANCE.md** (Locked UX/Intake Canon — defines WHAT the system must do)
2. **FUNCTION_INDEX.md** (Authoritative Registry)
3. **Webpage Contract Matrix v1.0** (ScreenplayFormatter row — UNVERIFIED)
4. **Definition of VERIFIED** (defines HOW we prove the system does it correctly)
5. **SCREENPLAY_QUALITY_STANDARD_CANON.md** (mandatory WriterDuet compliance)
6. **GOVERNANCE_EPIC_RG-EVAL-003.md** (this Epic — enforcement layer only)

**Critical Clarification:** SCREENPLAY_FORMATTER_GOVERNANCE.md already defines the user experience and system behavior. This Epic exists solely to wire the runtime enforcement layer (validators, audit, confidence scoring) that proves compliance with that canon.

If any artifact conflicts with the above, it is invalid.

---

## Current Compliance Status

**FAILED — Governance Bypass + Silent Routing Heuristic Proven**

### Evidence (from Verification Walkthrough #3)

- ❌ No `governedEvaluateEntry` call
- ❌ No SCREENPLAY_* validator execution
- ❌ No structured audit event (EVALUATE_REQUEST_EVENT)
- ❌ No SLA timing metrics
- 🔴 **[CRITICAL]** Format detection is implicit string matching (line 24), not governance-specified structural inspection
- ❌ Format detection result not logged or audited
- ❌ Routing decision made silently with no user visibility
- ❌ No classification taxonomy (governance specifies novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay)
- ❌ No confidence scoring (governance requires "≥95%" logic)

---

## Explicit Constraints (Must Be Restated in Jira)

1. **No implementation may begin without explicit phase authorization.**
2. **No wiring, refactoring, or runtime integration is allowed during drafting.**
3. **[ESCALATED] Implicit heuristics violate locked governance. All routing decisions must implement governance-specified inspection logic.**
4. **Any unauthorized work triggers a GOVERNANCE_BYPASS incident ticket.**
5. **Evidence is mandatory for all acceptance decisions.**

---

## Definition of VERIFIED (Acceptance Gate — Escalated for Routing)

ScreenplayFormatter may be promoted to **VERIFIED** only if all conditions below are evidenced:

### ✅ Routing Correct (AND Deterministic Per Governance)
- `input_format` correctly detected using governance-specified inspection (not string matching)
- Classification taxonomy matches governance: novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay
- `routed_pipeline` unambiguous and implements governance routing table
- **[ESCALATED]** Routing decision is made by validator implementing governance table, not heuristic
- Routing decision is logged with confidence score and audit trail

### ✅ Governed Entry Enforced
- `governedEvaluateEntry` executes before any conversion
- QA checklist enforced with halt-on-fail behavior
- Canon bundle loaded and validated

### ✅ Format Detection Validator Executed (MANDATORY — Per Governance)
- `SCREENPLAY_FORMAT_DETECT` validator runs (replaces line 24 string matching)
- Implements governance-specified structural inspection: ALL-CAPS names, INT./EXT. headers, indentation patterns, prose/dialogue ratios
- Returns: `detected_format` (governance taxonomy) + `confidence_score` (0–1)
- Fallback behavior per governance: confidence < 0.95 → proceed + append note (no blocking)
- **[NEW]** String matching heuristics are prohibited (governance violation)

### ✅ Validators Executed
- All SCREENPLAY_* validators load from `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md`
- Results logged (pass / soft / hard)

### ✅ Audit Record Written
- Structured EVALUATE_REQUEST_EVENT (or explicitly named, structured equivalent that contains all required fields, not free-text logs)
- Required fields populated:
  - `event_id`, `request_id`, `timestamp_utc`
  - `input_format` (using governance taxonomy)
  - `detected_format_confidence` (0–1 score)
  - `routed_pipeline`
  - `validators_run`, `validators_failed`, `failure_codes`

### ✅ SLA Timing Captured
- `start_ms`, `end_ms`, `elapsed_ms` minimum
- Written to audit record

### ✅ WriterDuet Compliance Enforced
- Output is true screenplay (not formatted prose)
- Compliance validators pass

### ✅ Negative Path Enforced (Per Governance)
- Invalid inputs blocked with user-visible error
- Low confidence (< 0.95) → proceed + append governance-specified note: "Format inferred automatically — review recommended."
- Per governance: "Never block. Never interrupt. Never ask."

**If any condition is missing → UNVERIFIED or FAILED.**

---

## Critical Gaps (Evidence from Walkthrough #3)

| Gap | Evidence | Severity | Governance Violation |
|-----|----------|----------|---------------------|
| **G1: Implicit routing heuristic** | Line 24: `contains('INT.')` \|\| `contains('EXT.')`? | 🔴 CRITICAL | **Violates SCREENPLAY_FORMATTER_GOVERNANCE.md Step 1** (should use structural inspection) |
| **G2: No format detection validator** | String matching, not governed structural inspector | 🔴 CRITICAL | **Violates SCREENPLAY_FORMATTER_GOVERNANCE.md Step 1** (inspection logic not implemented) |
| **G3: No classification taxonomy** | Binary convert/cleanup, not governance taxonomy | 🔴 CRITICAL | **Violates SCREENPLAY_FORMATTER_GOVERNANCE.md Step 1** (should return novel_prose \| hybrid_prose \| rough_screenplay \| formatted_screenplay) |
| **G4: No confidence scoring** | Binary logic, no confidence metric | 🔴 CRITICAL | **Violates SCREENPLAY_FORMATTER_GOVERNANCE.md Section 7** (confidence rule not implemented) |
| G5: No `governedEvaluateEntry` call | No wrapper invoked before conversion | 🔴 CRITICAL | Same as RG-EVAL-001/002 |
| G6: No SCREENPLAY_* validator execution | Zero references to `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md` | 🔴 CRITICAL | Same as RG-EVAL-001/002 |
| G7: No audit event | No EVALUATE_REQUEST_EVENT record with required fields | 🔴 CRITICAL | Same as RG-EVAL-001/002 |
| G8: No SLA metrics | No timing/performance tracking | 🟡 HIGH | Same as RG-EVAL-001/002 |
| G9: Format detection not surfaced per governance | Toast shows result but no governance-specified footer note for low confidence | 🟡 MEDIUM | **Violates SCREENPLAY_FORMATTER_GOVERNANCE.md Section 7** (footer note not implemented) |

---

## Required Child Tickets (MANDATORY)

### RG-EVAL-003-T1 — Replace Implicit Format Detection Heuristic (Canon Enforcement)
**Priority:** P0 (Blocks Verification)  
**Severity:** CRITICAL  
**Type:** Canon Compliance

**Description:**

**Existing Governance (SCREENPLAY_FORMATTER_GOVERNANCE.md — Step 1: Format Detection):**

> "System inspects for:
> - ALL-CAPS character names
> - INT./EXT. scene headings
> - Dialogue indentation patterns
> - Paragraph density and sentence length
> - Prose vs dialogue ratios
> 
> Classifications: novel_prose, hybrid_prose, rough_screenplay, formatted_screenplay"

**Current Implementation Violates This:**

Line 24 in `formatScreenplay.js`:
```javascript
const detectedMode = mode || (processedText.includes('INT.') || processedText.includes('EXT.') ? 'cleanup' : 'convert');
```

**Violations:**
- ❌ Binary string matching (not "structural inspection" per governance)
- ❌ No classification taxonomy (should return novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay)
- ❌ No confidence score (governance requires "confidence ≥95%" logic)
- ❌ No logging (governance implies auditability: "format inferred automatically")
- ❌ **Risk:** Prose containing "INT." or "EXT." in dialogue silently misrouted

**Required (Enforce Existing Governance):**
- Create `SCREENPLAY_FORMAT_DETECT` validator implementing governance-specified inspection logic
- **Input:** raw text
- **Output:** `detected_format` (novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay) + `confidence_score` (0–1)
- **Logic:** Structural analysis per governance (not string matching)
- **Confidence Rule (from governance):** if confidence < 0.95, proceed + append note (no blocking)
- Log detection result to audit record with confidence score

**Artifact Links:**
- **SCREENPLAY_FORMATTER_GOVERNANCE.md** (Step 1: Format Detection — authoritative spec)
- `FUNCTION_INDEX.md` (Screenplay → SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row)

**Acceptance Criteria (Canon Compliance):**
- [ ] `SCREENPLAY_FORMAT_DETECT` validator exists and is called before routing
- [ ] Returns taxonomy from governance: novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay
- [ ] Returns `confidence_score` (0–1)
- [ ] Implements structural inspection per governance (ALL-CAPS names, INT./EXT. headers, indentation, ratios)
- [ ] String matching heuristic (line 24) completely removed
- [ ] Confidence < 0.95 → proceed + append note (per governance)
- [ ] Evidence: logs show validator execution with confidence scores and classification taxonomy

**Impact:** CRITICAL — blocks canon compliance and promotion to VERIFIED

---

### RG-EVAL-003-T2 — Wire governedEvaluateEntry into ScreenplayFormatter
**Priority:** P0 (Blocks Verification)  
**Type:** Canon Compliance

**Description:**

Current state: `ScreenplayFormatter.js` (lines 33-66) calls `formatScreenplay` directly, bypassing governance wrapper.

**Required:**
- `ScreenplayFormatter.js` must call `governedEvaluateEntry` FIRST
- `governedEvaluateEntry` validates input against `EVALUATE_QA_CHECKLIST.md`
- Only if validation passes, proceed to `formatScreenplay`
- If validation fails, halt and return error with checklist violations

**Artifact Links:**
- `FUNCTION_INDEX.md` (Screenplay → Runtime → governedEvaluateEntry.js)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row, Required Gates column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `ScreenplayFormatter.js` calls `governedEvaluateEntry` BEFORE `formatScreenplay` (line 33 or earlier)
- [ ] `governedEvaluateEntry` loads and executes `EVALUATE_QA_CHECKLIST.md`
- [ ] If checklist fails, returns error and halts (no conversion)
- [ ] If checklist passes, proceeds to `formatScreenplay`
- [ ] Evidence: logs show `governedEvaluateEntry` call + QA checklist result
- [ ] Evidence: test with invalid input shows halted flow + error

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-003-T3 — Implement SCREENPLAY_WORD_COUNT Validator
**Priority:** P0 (Blocks Verification)  
**Type:** Canon Compliance

**Description:**

Current state: No word count validation at conversion layer.

**Required:**
- Create `SCREENPLAY_WORD_COUNT` validator
- Enforce min/max word count thresholds per `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md`
- Reject oversized or undersized inputs with user-visible error
- Log validation result to audit record

**Artifact Links:**
- `FUNCTION_INDEX.md` (Screenplay → SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `SCREENPLAY_WORD_COUNT` validator exists and is called
- [ ] Returns pass/soft-fail/hard-fail with threshold comparison
- [ ] Out-of-range inputs rejected with error message
- [ ] Evidence: logs show validator execution + result

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-003-T4 — Implement SCREENPLAY_ROUTE_DECISION Validator (Canon Enforcement)
**Priority:** P0 (Blocks Verification)  
**Type:** Canon Compliance

**Description:**

**Existing Governance (SCREENPLAY_FORMATTER_GOVERNANCE.md — Step 3: Routing Table):**

| Detected Format | Detected Scope | Action |
|----------------|----------------|--------|
| novel_prose | chapter | Convert → screenplay scenes |
| novel_prose | full_manuscript | Convert → full screenplay |
| hybrid_prose | any | Normalize → screenplay |
| rough_screenplay | any | Clean + reformat |
| formatted_screenplay | any | Validate + standardize |

> "No user confirmation required unless confidence < threshold."

**Current Implementation Violates This:**

Line 24 routing is implicit binary string matching, not deterministic rule application from governance table.

**Required (Enforce Existing Governance):**
- Create `SCREENPLAY_ROUTE_DECISION` validator implementing governance routing table
- **Input:** `detected_format` (from T1) + `detected_scope` + `detected_confidence`
- **Output:** `routed_pipeline` (convert | cleanup | validate) + routing decision factors
- **Logic:** Apply governance routing table deterministically
- **Confidence Rule (from governance):** confidence < 0.95 → proceed silently + append note (no user escalation)
- Log routing decision to audit record with governance table row matched

**Artifact Links:**
- **SCREENPLAY_FORMATTER_GOVERNANCE.md** (Step 3: Routing Table — authoritative spec)
- `FUNCTION_INDEX.md` (Screenplay → SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row, Routing column)

**Acceptance Criteria (Canon Compliance):**
- [ ] `SCREENPLAY_ROUTE_DECISION` validator exists and is called after format detection
- [ ] Returns `routed_pipeline` (convert | cleanup | validate)
- [ ] Returns routing decision factors (which governance table row matched)
- [ ] Routing logic explicitly implements governance table (no heuristics)
- [ ] Confidence < 0.95 → proceed + note (per governance: "never block, never interrupt")
- [ ] Evidence: logs show routing decision with governance table row matched
- [ ] Evidence: test with low-confidence input shows silent proceed + note (not escalation)

**Impact:** CRITICAL — blocks canon compliance and promotion to VERIFIED

---

### RG-EVAL-003-T5 — Implement Audit Event Creation (ScreenplayFormatter)
**Priority:** P0 (Blocks Verification)  
**Type:** Canon Compliance

**Description:**

Current state: No audit record. Conversions are unlogged.

**Required:**
- `formatScreenplay.js` must write audit record at START of conversion
- Update audit record at END with results (validators, routing, SLA)
- Audit record must include all required fields plus format detection confidence and routing decision factors

**Artifact Links:**
- `FUNCTION_INDEX.md` (Platform Standards → EVALUATE_INCIDENT_LOG_SCHEMA.md)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row, Audit Evidence column)
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (audit schema spec)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `EvaluationAuditEvent` entity (created in RG-EVAL-001) is used for screenplay conversions
- [ ] `formatScreenplay` writes audit record with `event_id`, `request_id`, `timestamp_utc`
- [ ] Audit record includes `detected_format` (using governance taxonomy)
- [ ] Audit record includes `detected_format_confidence`
- [ ] Audit record includes `routed_pipeline` + `routing_decision_factors`
- [ ] Audit record includes `validators_run`, `validators_failed`, `failure_codes`
- [ ] Evidence: query `EvaluationAuditEvent` after test run shows complete record

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-003-T6 — Implement SLA Timing Metrics (ScreenplayFormatter)
**Priority:** P1 (High)  
**Type:** Canon Compliance

**Description:**

Current state: No timing metrics captured.

**Required:**

`formatScreenplay.js` must wrap all LLM calls and major operations with timing:
- Capture `start_timestamp_ms` before operation
- Capture `end_timestamp_ms` after operation
- Calculate `elapsed_ms = end - start`
- Write to audit record's `sla_metrics` field

**Operations to time:**
- Format detection
- Routing decision
- Text preprocessing
- LLM call for screenplay generation
- Overall conversion duration

**Artifact Links:**
- `FUNCTION_INDEX.md` (Screenplay → SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md)
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (sla_metrics field spec)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `sla_metrics` object in audit record
- [ ] `start_ms`, `end_ms`, `elapsed_ms` for each operation
- [ ] `operations` array with per-operation timing
- [ ] Evidence: audit record shows complete timing data

**Impact:** HIGH — required for VERIFIED status

---

### RG-EVAL-003-T7 — Surface Format Detection Result in UI (Canon Enforcement)
**Priority:** P2 (Medium)  
**Type:** Canon Compliance

**Description:**

**Existing Governance (SCREENPLAY_FORMATTER_GOVERNANCE.md — Section 7: Confidence Rule):**

> "If detection confidence < 95%:
> - Proceed anyway
> - Append subtle footer note: 'Format inferred automatically — review recommended.'
> Never block. Never interrupt. Never ask."

**Current Implementation:**

Line 51-54 shows toast with detected format, but:
- ❌ No confidence score shown
- ❌ No governance-specified footer note for low confidence
- ❌ No persistent UI element (toast disappears)

**Required (Enforce Existing Governance):**
- Display format detection result per governance specifications
- Show confidence score if < 0.95
- **If confidence < 0.95:** Append exact governance footer note: "Format inferred automatically — review recommended."
- Implement as subtle footer note (not modal, not blocking)
- Preserve existing toast for immediate feedback

**Artifact Links:**
- **SCREENPLAY_FORMATTER_GOVERNANCE.md** (Section 7: Confidence Rule — authoritative spec)
- `pages/ScreenplayFormatter.js` (lines 51-54)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row, User Visibility column)

**Acceptance Criteria (Canon Compliance):**
- [ ] UI shows detected format taxonomy (novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay)
- [ ] If confidence < 0.95 → show governance-specified footer note exactly as written
- [ ] Footer note is subtle, non-blocking, non-modal (per governance)
- [ ] Toast remains for immediate feedback
- [ ] Footer note appears only for low confidence (per governance)
- [ ] Evidence: screenshot showing footer note for low-confidence input

**Impact:** MEDIUM — enforces governance visibility requirement

---

### RG-EVAL-003-T8 — Governance Dependency Check (ScreenplayFormatter)
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
RG-EVAL-003-T8 (Dependency Check)
  ↓
RG-EVAL-003-T1 (Format Detection Validator — Canon Enforcement) + RG-EVAL-003-T4 (Route Decision Validator — Canon Enforcement)
  ↓
RG-EVAL-003-T2 (Governed Entry) + RG-EVAL-003-T3 (Word Count) + RG-EVAL-003-T5 (Audit) + RG-EVAL-003-T6 (SLA)
  ↓
RG-EVAL-003-T7 (UI Visibility — Canon Enforcement)
```

**Critical Path:** T8 → T1/T4 (parallel) → T2/T3/T5/T6 (parallel) → T7

---

## Incident Handling (Mandatory)

Any of the following must result in a governance incident ticket:

- Work begins without authorization
- Phase sequencing violated
- Implicit heuristics introduced or retained (governance violation)
- Governance hooks bypassed
- Evidence missing at review time

**Incident Type:** GOVERNANCE_BYPASS

**Required Fields:**
- Epic
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

**This Epic is governance-blocking with critical escalation.**

- No code may be written, wired, or deployed until the Epic is acknowledged in Jira and Phase authorization is explicitly granted.
- **Implicit heuristics violate locked governance (SCREENPLAY_FORMATTER_GOVERNANCE.md). All routing decisions must implement governance-specified inspection logic and routing tables.**
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

### Phase 2: Format Detection & Routing Validators — Canon Enforcement (T1, T4)
**Authorization Required Before Starting**  
**Deadline: 2026-01-20 (Monday)**
- Replace implicit heuristic with SCREENPLAY_FORMAT_DETECT validator implementing governance inspection logic
- Implement SCREENPLAY_ROUTE_DECISION validator implementing governance routing table
- Remove line 24 string matching completely
- Add confidence scoring per governance (≥95% logic)
- Add governance classification taxonomy (novel_prose | hybrid_prose | rough_screenplay | formatted_screenplay)

### Phase 3: Core Governance Hooks (T2, T3, T5, T6)
**Authorization Required Before Starting**  
**Deadline: 2026-01-27 (Monday)**
- Wire governed entry
- Add word count validator
- Create audit records
- Capture SLA metrics

### Phase 4: UI Visibility — Canon Enforcement (T7)
**Authorization Required Before Starting**  
**Deadline: 2026-01-31 (Friday)**
- Surface format detection results using governance taxonomy
- Show confidence scores
- Display governance-specified footer note for low confidence: "Format inferred automatically — review recommended."

### Phase 5: Evidence & Promotion
**Authorization Required Before Starting**  
**Deadline: 2026-02-03 (Tuesday)**
- Collect all evidence
- Human review against Definition of VERIFIED + SCREENPLAY_FORMATTER_GOVERNANCE.md
- Promote to VERIFIED or iterate

---

## Success Criteria

This Epic is complete when:

1. All 8 tickets marked DONE with evidence links
2. Verification Walkthrough #3 re-run shows VERIFIED status
3. **No implicit routing heuristics remain in codebase** (governance violation eliminated)
4. **Format detection and routing implement SCREENPLAY_FORMATTER_GOVERNANCE.md specifications**
5. ScreenplayFormatter row in Webpage Contract Matrix updated to VERIFIED
6. No open governance incidents related to this Epic

**Until then, ScreenplayFormatter remains FAILED and release-blocked.**