# JIRA EPIC — GOVERNANCE REMEDIATION (CRITICAL ESCALATION)

## Epic ID
**RG-EVAL-003**

## Epic Name
**RevisionGrade Governance & Verification — Convert Surface (ScreenplayFormatter)**

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

This Epic addresses not just governance bypass, but a **systemic routing correctness risk**.

**ScreenplayFormatter contains implicit format detection heuristics** (line 24 in `formatScreenplay.js`) that silently route requests based on string matching (`contains('INT.') || contains('EXT.')?`), without:

- ❌ Validation
- ❌ Auditing
- ❌ Confidence scoring
- ❌ Fallback behavior
- ❌ User visibility

**This creates a correctness risk:** A user's prose containing the words "INT." or "EXT." in dialogue can be silently misclassified and routed to the wrong pipeline, with no audit trail and no user awareness.

**Governance Response:** Implicit heuristics are forbidden. All routing decisions must be validator-based, scored, logged, and auditable.

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

This Epic remediates:

1. **Governance bypass** (identified in FUNCTION TEST #3)
2. **Silent routing heuristics** (critical correctness risk)

The ScreenplayFormatter surface performs conversion but **bypasses the governed Evaluate chain**, violates FUNCTION_INDEX.md and Definition of VERIFIED, and **introduces undetectable misclassification risk**.

**This Epic exists to restore validator-based determinism and auditability.**

---

## Governing Authority (Hierarchy — Locked)

All work under this Epic is governed by, in order:

1. **FUNCTION_INDEX.md** (Authoritative Registry)
2. **Webpage Contract Matrix v1.0** (ScreenplayFormatter row — UNVERIFIED)
3. **Definition of VERIFIED** (with escalated routing requirement)
4. **SCREENPLAY_QUALITY_STANDARD_CANON.md** (mandatory WriterDuet compliance)
5. **GOVERNANCE_EPIC_RG-EVAL-003.md** (this Epic)

If any artifact conflicts with the above, it is invalid.

---

## Current Compliance Status

**FAILED — Governance Bypass + Silent Routing Heuristic Proven**

### Evidence (from Verification Walkthrough #3)

- ❌ No `governedEvaluateEntry` call
- ❌ No SCREENPLAY_* validator execution
- ❌ No structured audit event (EVALUATE_REQUEST_EVENT)
- ❌ No SLA timing metrics
- 🔴 **[CRITICAL]** Format detection is implicit string matching (line 24), not a governed validator
- ❌ Format detection result not logged or audited
- ❌ Routing decision made silently with no user visibility

---

## Explicit Constraints (Must Be Restated in Jira)

1. **No implementation may begin without explicit phase authorization.**
2. **No wiring, refactoring, or runtime integration is allowed during drafting.**
3. **[ESCALATED] Implicit heuristics are forbidden. All routing decisions must be validator-based.**
4. **Any unauthorized work triggers a GOVERNANCE_BYPASS incident ticket.**
5. **Evidence is mandatory for all acceptance decisions.**

---

## Definition of VERIFIED (Acceptance Gate — Escalated for Routing)

ScreenplayFormatter may be promoted to **VERIFIED** only if all conditions below are evidenced:

### ✅ Routing Correct (AND Deterministic)
- `input_format` correctly detected (prose vs screenplay)
- `routed_pipeline` unambiguous (convert vs cleanup vs evaluate)
- **[ESCALATED]** Routing decision is made by validator, not heuristic
- Routing decision is logged with confidence score and audit trail

### ✅ Governed Entry Enforced
- `governedEvaluateEntry` executes before any conversion
- QA checklist enforced with halt-on-fail behavior
- Canon bundle loaded and validated

### ✅ Format Detection Validator Executed (MANDATORY)
- `SCREENPLAY_FORMAT_DETECT` validator runs (replaces line 24 string matching)
- Returns: `detected_format` + `confidence_score` (0–1)
- Fallback behavior defined (low confidence → escalate to user)
- **[NEW]** String matching heuristics are prohibited

### ✅ Validators Executed
- All SCREENPLAY_* validators load from `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md`
- Results logged (pass / soft / hard)

### ✅ Audit Record Written
- Structured EVALUATE_REQUEST_EVENT (or explicitly named, structured equivalent that contains all required fields, not free-text logs)
- Required fields populated:
  - `event_id`, `request_id`, `timestamp_utc`
  - `input_format` (prose | screenplay | ambiguous)
  - `detected_format_confidence` (0–1 score)
  - `routed_pipeline`
  - `validators_run`, `validators_failed`, `failure_codes`

### ✅ SLA Timing Captured
- `start_ms`, `end_ms`, `elapsed_ms` minimum
- Written to audit record

### ✅ WriterDuet Compliance Enforced
- Output is true screenplay (not formatted prose)
- Compliance validators pass

### ✅ Negative Path Enforced
- Invalid inputs blocked with user-visible error
- Ambiguous format detection (confidence < threshold) escalates to user, not silently routed

**If any condition is missing → UNVERIFIED or FAILED.**

---

## Critical Gaps (Evidence from Walkthrough #3)

| Gap | Evidence | Severity | NEW vs RG-EVAL-001/002 |
|-----|----------|----------|------------------------|
| **G1: Implicit routing heuristic** | Line 24: `contains('INT.')` \|\| `contains('EXT.')`? | 🔴 CRITICAL | **[ESCALATED]** Unique to ScreenplayFormatter |
| **G2: No format detection validator** | String matching, not governed validator | 🔴 CRITICAL | **[ESCALATED]** Unique to ScreenplayFormatter |
| G3: No `governedEvaluateEntry` call | No wrapper invoked before conversion | 🔴 CRITICAL | Same as RG-EVAL-001/002 |
| G4: No SCREENPLAY_* validator execution | Zero references to `SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md` | 🔴 CRITICAL | Same as RG-EVAL-001/002 |
| G5: No audit event | No EVALUATE_REQUEST_EVENT record with required fields | 🔴 CRITICAL | Same as RG-EVAL-001/002 |
| G6: No SLA metrics | No timing/performance tracking | 🟡 HIGH | Same as RG-EVAL-001/002 |
| G7: Format detection not surfaced | Toast shows result but not structured or logged | 🟡 MEDIUM | Same as RG-EVAL-001/002 |
| **G8: No confidence scoring** | Binary string match, no confidence metric | 🔴 CRITICAL | **[ESCALATED]** Unique to ScreenplayFormatter |

---

## Required Child Tickets (MANDATORY)

### RG-EVAL-003-T1 — Replace Implicit Format Detection Heuristic
**Priority:** P0 (Blocks Verification)  
**Severity:** CRITICAL

**Description:**

Current state (line 24 in `formatScreenplay.js`):

```javascript
const detectedMode = mode || (processedText.includes('INT.') || processedText.includes('EXT.') ? 'cleanup' : 'convert');
```

**Problem:**
- Binary string matching (crude heuristic)
- No confidence score
- No logging
- Silent routing decision
- **Risk:** Prose containing "INT." or "EXT." in dialogue silently misrouted

**Required:**
- Create `SCREENPLAY_FORMAT_DETECT` validator
- **Input:** raw text
- **Output:** `detected_format` (prose | screenplay | ambiguous) + `confidence_score` (0–1)
- **Logic:** structured analysis, not string matching
- **Fallback:** if confidence < 0.8, escalate to user or halt
- Log detection result to audit record with confidence score

**Artifact Links:**
- `FUNCTION_INDEX.md` (Screenplay → SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row)
- `SCREENPLAY_QUALITY_STANDARD_CANON.md` (format detection rules)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `SCREENPLAY_FORMAT_DETECT` validator exists and is called before routing
- [ ] Returns `detected_format` + `confidence_score`
- [ ] Confidence score logic documented (thresholds, fallback behavior)
- [ ] String matching heuristic (line 24) completely removed
- [ ] Evidence: logs show validator execution with confidence scores
- [ ] Evidence: low-confidence inputs escalate to user or halt (not silent routing)

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-003-T2 — Wire governedEvaluateEntry into ScreenplayFormatter
**Priority:** P0 (Blocks Verification)

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

### RG-EVAL-003-T4 — Implement SCREENPLAY_ROUTE_DECISION Validator
**Priority:** P0 (Blocks Verification)

**Description:**

Current state: Routing decision made implicitly (line 24 string matching).

**Required:**
- Create `SCREENPLAY_ROUTE_DECISION` validator
- **Input:** `detected_format` + `detected_confidence` + `user_intent`
- **Output:** `routed_pipeline` (convert | cleanup | evaluate) + `confidence_score`
- **Logic:** deterministic, based on input format and confidence thresholds
- **Fallback:** ambiguous cases escalate to user instead of silent routing
- Log routing decision to audit record with decision logic

**Artifact Links:**
- `FUNCTION_INDEX.md` (Screenplay → SCREENPLAY_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row, Routing column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `SCREENPLAY_ROUTE_DECISION` validator exists and is called after format detection
- [ ] Returns `routed_pipeline` + `confidence_score`
- [ ] Routing logic is explicit and documented (no implicit heuristics)
- [ ] Ambiguous cases (confidence < threshold) escalate to user
- [ ] Evidence: logs show routing decision with decision factors
- [ ] Evidence: test with ambiguous input shows escalation (not silent routing)

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-003-T5 — Implement Audit Event Creation (ScreenplayFormatter)
**Priority:** P0 (Blocks Verification)

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
- [ ] Audit record includes `detected_format` + `detected_format_confidence`
- [ ] Audit record includes `routed_pipeline` + `routing_decision_factors`
- [ ] Audit record includes `validators_run`, `validators_failed`, `failure_codes`
- [ ] Evidence: query `EvaluationAuditEvent` after test run shows complete record

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-EVAL-003-T6 — Implement SLA Timing Metrics (ScreenplayFormatter)
**Priority:** P1 (High)

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

### RG-EVAL-003-T7 — Surface Format Detection Result in UI
**Priority:** P2 (Medium)

**Description:**

Current state: Format detection shown via toast (line 51-54), not structured.

**Required:**
- Display format detection result in structured UI element
- Show confidence score if available
- Indicate routing decision (convert vs cleanup)
- Provide user with visibility into what happened

**Artifact Links:**
- `pages/ScreenplayFormatter.js` (lines 51-54)
- Webpage Contract Matrix v1.0 (ScreenplayFormatter row, User Visibility column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] UI shows detected format (prose | screenplay | ambiguous)
- [ ] UI shows confidence score if < 1.0
- [ ] UI shows routing decision (convert | cleanup)
- [ ] Toast messages supplemented with persistent UI element
- [ ] Evidence: screenshot showing format detection UI

**Impact:** MEDIUM — improves user visibility

---

### RG-EVAL-003-T8 — Governance Dependency Check (ScreenplayFormatter)
**Priority:** P0 (Blocks All Other Work)

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
RG-EVAL-003-T1 (Format Detection Validator) + RG-EVAL-003-T4 (Route Decision Validator)
  ↓
RG-EVAL-003-T2 (Governed Entry) + RG-EVAL-003-T3 (Word Count) + RG-EVAL-003-T5 (Audit) + RG-EVAL-003-T6 (SLA)
  ↓
RG-EVAL-003-T7 (UI Visibility)
```

**Critical Path:** T8 → T1/T4 (parallel) → T2/T3/T5/T6 (parallel) → T7

---

## Incident Handling (Mandatory)

Any of the following must result in a governance incident ticket:

- Work begins without authorization
- Phase sequencing violated
- Implicit heuristics introduced or retained
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
- **Implicit routing heuristics are explicitly prohibited and must be replaced with validator-based deterministic routing.**
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

### Phase 2: Format Detection & Routing Validators (T1, T4)
**Authorization Required Before Starting**
**Deadline: 2026-01-20 (Monday)**
- Replace implicit heuristic with SCREENPLAY_FORMAT_DETECT validator
- Implement SCREENPLAY_ROUTE_DECISION validator
- Remove line 24 string matching completely
- Add confidence scoring and fallback behavior

### Phase 3: Core Governance Hooks (T2, T3, T5, T6)
**Authorization Required Before Starting**
**Deadline: 2026-01-27 (Monday)**
- Wire governed entry
- Add word count validator
- Create audit records
- Capture SLA metrics

### Phase 4: UI Visibility (T7)
**Authorization Required Before Starting**
**Deadline: 2026-01-31 (Friday)**
- Surface format detection results
- Show confidence scores
- Display routing decisions

### Phase 5: Evidence & Promotion
**Authorization Required Before Starting**
**Deadline: 2026-02-03 (Tuesday)**
- Collect all evidence
- Human review against Definition of VERIFIED
- Promote to VERIFIED or iterate

---

## Success Criteria

This Epic is complete when:

1. All 8 tickets marked DONE with evidence links
2. Verification Walkthrough #3 re-run shows VERIFIED status
3. **No implicit routing heuristics remain in codebase**
4. ScreenplayFormatter row in Webpage Contract Matrix updated to VERIFIED
5. No open governance incidents related to this Epic

**Until then, ScreenplayFormatter remains FAILED and release-blocked.**