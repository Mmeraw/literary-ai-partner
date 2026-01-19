# JIRA EPIC: RevisionGrade Governance & Verification – Evaluate Surface (YourWriting)

**Epic ID:** RG-EVAL-001  
**Epic Name:** RevisionGrade Governance & Verification – Evaluate Surface (YourWriting)  
**Type:** Governance-Compliance Remediation  
**Status:** Not Started  
**Created:** 2026-01-03  
**Target Completion:** 2026-01-20 (Governance-Blocking Release Gate)

---

## Epic Description

This Epic remediates governance gaps identified during Verification Walkthrough #1 (YourWriting / Evaluate surface). The current implementation bypasses the governed chain defined in FUNCTION_INDEX.md, lacks validator execution, missing audit records, and has no SLA metrics.

**Scope:** YourWriting (Evaluate surface) only – Quick Evaluation and Full Manuscript pipelines.

**Authority Documents:**
- FUNCTION_INDEX.md (Authoritative Registry)
- Webpage Contract Matrix v1.0 (YourWriting row: LOCKED / UNVERIFIED)
- Definition of VERIFIED (Promotion Rules)

**Current Status:** FAILED (Contract Breach)

---

## Definition of VERIFIED (Acceptance Gate)

A surface may be promoted from UNVERIFIED → VERIFIED only when:

1. **Routing correct** — detected_format triggers correct pipeline
2. **Required functions evidenced** — all touchpoints listed in FUNCTION_INDEX fire with proof
3. **Validators + audit record present** — EVAL_* validators run, audit event written with required fields (event_id, request_id, timestamp_utc, detected_format, routed_pipeline, validators_run/failed/failure_codes)
4. **SLA timing captured** — start/end timestamps minimum, elapsed_ms ideal

**Failure Modes:**
- **PARTIALLY VERIFIED** — Routing correct, outputs correct, but validator/SLA/audit hooks incomplete → must open tickets
- **FAILED** — Page bypasses governed chain, detection/routing incorrect, validators absent, audit record missing

---

## Critical Gaps (Evidence from Walkthrough #1)

| Gap | Evidence | Severity |
|-----|----------|----------|
| **G1: Inline logic bypass** | evaluateQuickSubmission.js and evaluateFullManuscript.js inline LLM calls instead of delegating to evaluateThirteenCriteria.js, evaluateSpine.js, evaluateWaveFlags.js | 🔴 CRITICAL |
| **G2: No validator execution** | Zero references to EVALUATE_RULE_VALIDATOR_SLA_MAP.md, no EVAL_* validator hooks | 🔴 CRITICAL |
| **G3: No audit event** | No EVALUATE_REQUEST_EVENT record with required fields | 🔴 CRITICAL |
| **G4: No SLA metrics** | No timing/performance tracking | 🟡 HIGH |
| **G5: Governance bundle not loaded** | No references to EVALUATE_ENTRY_CANON.md, EVALUATE_GOVERNANCE_ADDENDUM.md, EVALUATE_QA_CHECKLIST.md | 🔴 CRITICAL |
| **G6: Parameter logging incomplete** | languageVariant and voicePreservation passed but not consistently logged in results | 🟡 MEDIUM |

---

## Child Tickets

### Ticket 1: Implement EVAL_* Validator Execution Hooks

**Ticket ID:** RG-EVAL-001-T1  
**Summary:** Implement EVAL_* Validator Execution Hooks (evaluateQuickSubmission & evaluateFullManuscript)  
**Type:** Governance Compliance Task  
**Priority:** P0 (Blocks Verification)

**Description:**

Current state: Zero validator execution. No references to EVALUATE_RULE_VALIDATOR_SLA_MAP.md.

Required: Both evaluateQuickSubmission.js and evaluateFullManuscript.js must:
1. Load EVALUATE_RULE_VALIDATOR_SLA_MAP.md at runtime
2. Execute each validator defined in the map with pass/soft-fail/hard-fail result
3. Log validator results to EVALUATE_REQUEST_EVENT audit record
4. Respect SLA timing constraints per validator

**Artifact Links:**
- FUNCTION_INDEX.md (Evaluate → Canon Documents → EVALUATE_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (YourWriting row, Governance Bundle column)
- EVALUATE_RULE_VALIDATOR_SLA_MAP.md (validator registry)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] Validators load from EVALUATE_RULE_VALIDATOR_SLA_MAP.md on each request
- [ ] All EVAL_* validators execute and return pass/soft-fail/hard-fail
- [ ] Validator results logged to audit event with validator_name, result, failure_code (if failed)
- [ ] Evidence: logs/traces show validator execution with timestamps
- [ ] Evidence: audit record includes validators_run array and validators_failed array

**Impact:** Critical — blocks promotion to VERIFIED

---

### Ticket 2: Implement EVALUATE_REQUEST_EVENT Audit Record

**Ticket ID:** RG-EVAL-001-T2  
**Summary:** Create EvaluationAuditEvent entity and write EVALUATE_REQUEST_EVENT on every request  
**Type:** Governance Compliance Task  
**Priority:** P0 (Blocks Verification)

**Description:**

Current state: No audit record. Submissions and Manuscripts are written but don't match audit schema.

Required:
1. Create `EvaluationAuditEvent` entity with schema:
   - event_id (string, unique)
   - request_id (string, ties multiple events together)
   - timestamp_utc (datetime)
   - detected_format (enum: scene/chapter/manuscript/screenplay)
   - routed_pipeline (enum: quick/manuscript)
   - user_email (string)
   - evaluation_mode (string)
   - language_variant (string)
   - voice_preservation (string)
   - validators_run (array of strings)
   - validators_failed (array of strings)
   - failure_codes (array of strings)
   - sla_metrics (object: start_ms, end_ms, elapsed_ms)
   - submission_id or manuscript_id (reference)

2. Write audit record at START of evaluation (before LLM calls)
3. Update audit record at END with results (validators, SLA, output_id)

**Artifact Links:**
- FUNCTION_INDEX.md (Platform Standards → EVALUATE_INCIDENT_LOG_SCHEMA.md)
- Webpage Contract Matrix v1.0 (YourWriting row, Audit Evidence column)
- EVALUATE_INCIDENT_LOG_SCHEMA.md (audit schema spec)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] EvaluationAuditEvent entity exists with all required fields
- [ ] evaluateQuickSubmission writes audit record with event_id, request_id, timestamp_utc
- [ ] evaluateFullManuscript writes audit record with event_id, request_id, timestamp_utc
- [ ] Audit record includes detected_format (scene/chapter/manuscript)
- [ ] Audit record includes routed_pipeline (quick/manuscript)
- [ ] Audit record includes validators_run, validators_failed, failure_codes
- [ ] Evidence: query EvaluationAuditEvent after test run shows complete record

**Impact:** Critical — blocks promotion to VERIFIED

---

### Ticket 3: Implement SLA Timing Metrics

**Ticket ID:** RG-EVAL-001-T3  
**Summary:** Capture SLA timing metrics (start/end/elapsed) for all Evaluate touchpoints  
**Type:** Governance Compliance Task  
**Priority:** P1 (High)

**Description:**

Current state: No timing metrics captured.

Required: Wrap all LLM calls and major operations with timing instrumentation:
1. Capture `start_timestamp_ms` before operation
2. Capture `end_timestamp_ms` after operation
3. Calculate `elapsed_ms = end - start`
4. Write to audit record's `sla_metrics` field

Operations to time:
- Agent criteria analysis (13 criteria)
- Spine synthesis
- WAVE tier evaluations (early, mid, late)
- Chapter summaries
- Overall evaluation duration

**Artifact Links:**
- FUNCTION_INDEX.md (Evaluate → EVALUATE_RULE_VALIDATOR_SLA_MAP.md)
- Webpage Contract Matrix v1.0 (YourWriting row, SLA Evidence column)
- EVALUATE_RULE_VALIDATOR_SLA_MAP.md (SLA thresholds)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] All LLM calls wrapped with timestamp capture (start, end, elapsed)
- [ ] SLA metrics written to audit record
- [ ] Evidence: logs/traces show timing for each operation
- [ ] Evidence: audit record includes sla_metrics object with operation_name, start_ms, end_ms, elapsed_ms

**Impact:** High — partial verification possible without this, but full verification requires it

---

### Ticket 4: Refactor evaluateQuickSubmission — Normalize to Governed Modules

**Ticket ID:** RG-EVAL-001-T4  
**Summary:** Refactor evaluateQuickSubmission.js to call evaluateThirteenCriteria.js and evaluateWaveFlags.js  
**Type:** Governance Compliance Task  
**Priority:** P0 (Blocks Verification)

**Description:**

Current state: evaluateQuickSubmission.js inlines agent analysis and WAVE analysis logic instead of delegating to governed modules.

Required:
1. Extract inline agent analysis (lines 37-108) and move to `evaluateThirteenCriteria.js` if not already there
2. Replace inline logic with call to `evaluateThirteenCriteria.js`
3. Extract inline WAVE analysis (lines 237-308) and move to `evaluateWaveFlags.js` if not already there
4. Replace inline logic with call to `evaluateWaveFlags.js`
5. Pass evaluationMode, languageVariant, voicePreservation as parameters

**Artifact Links:**
- FUNCTION_INDEX.md (Evaluate → Runtime → evaluateThirteenCriteria.js, evaluateWaveFlags.js)
- Webpage Contract Matrix v1.0 (YourWriting row, Process column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] evaluateQuickSubmission.js no longer contains inline LLM prompts for agent criteria
- [ ] evaluateQuickSubmission.js calls evaluateThirteenCriteria.js with correct parameters
- [ ] evaluateQuickSubmission.js no longer contains inline WAVE logic
- [ ] evaluateQuickSubmission.js calls evaluateWaveFlags.js with correct parameters
- [ ] Evidence: logs show function call chain: evaluateQuickSubmission → evaluateThirteenCriteria + evaluateWaveFlags
- [ ] Output remains functionally identical to inline version

**Impact:** Critical — blocks promotion to VERIFIED (architectural compliance)

---

### Ticket 5: Refactor evaluateFullManuscript — Normalize to Governed Modules

**Ticket ID:** RG-EVAL-001-T5  
**Summary:** Refactor evaluateFullManuscript.js to call evaluateThirteenCriteria.js, evaluateSpine.js, evaluateWaveFlags.js  
**Type:** Governance Compliance Task  
**Priority:** P0 (Blocks Verification)

**Description:**

Current state: evaluateFullManuscript.js inlines agent criteria, spine synthesis, and WAVE tier logic instead of delegating to governed modules.

Required:
1. Extract inline agent criteria logic (lines 19-123) → call `evaluateThirteenCriteria.js`
2. Extract inline spine synthesis logic (lines 673-746) → call `evaluateSpine.js`
3. Extract inline WAVE tier logic (lines 126-237) → call `evaluateWaveFlags.js`
4. Preserve parallel execution pattern (Promise.allSettled for tiers)
5. Pass evaluationMode, integrity, integrityPenalty as parameters

**Artifact Links:**
- FUNCTION_INDEX.md (Evaluate → Runtime → evaluateThirteenCriteria.js, evaluateSpine.js, evaluateWaveFlags.js)
- Webpage Contract Matrix v1.0 (YourWriting row, Process column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] evaluateFullManuscript.js no longer contains inline agent criteria prompts
- [ ] evaluateFullManuscript.js calls evaluateThirteenCriteria.js per chapter
- [ ] evaluateFullManuscript.js no longer contains inline spine synthesis prompts
- [ ] evaluateFullManuscript.js calls evaluateSpine.js with chapter summaries
- [ ] evaluateFullManuscript.js no longer contains inline WAVE tier prompts
- [ ] evaluateFullManuscript.js calls evaluateWaveFlags.js with tier parameter (early/mid/late)
- [ ] Evidence: logs show function call chain for each chapter
- [ ] Output remains functionally identical to inline version

**Impact:** Critical — blocks promotion to VERIFIED (architectural compliance)

---

### Ticket 6: Implement Governance Entry Wrapper

**Ticket ID:** RG-EVAL-001-T6  
**Summary:** Create governance entry wrapper that loads canon bundle and enforces QA checklist  
**Type:** Governance Compliance Task  
**Priority:** P0 (Blocks Verification)

**Description:**

Current state: No references to EVALUATE_ENTRY_CANON.md, EVALUATE_GOVERNANCE_ADDENDUM.md, EVALUATE_QA_CHECKLIST.md in runtime code.

Required:
1. Create `governedEvaluateEntry.js` wrapper function that:
   - Loads EVALUATE_ENTRY_CANON.md (authority document)
   - Loads EVALUATE_GOVERNANCE_ADDENDUM.md (mode-specific overrides)
   - Loads EVALUATE_QA_CHECKLIST.md (pre-flight checks)
   - Executes QA checklist (e.g., text not empty, word count in range, mode valid)
   - Returns pass/fail + checklist_results
2. Both evaluateQuickSubmission and evaluateFullManuscript must call this wrapper FIRST
3. If QA checklist fails, halt evaluation and return error with checklist violations

**Artifact Links:**
- FUNCTION_INDEX.md (Evaluate → Canon Documents → EVALUATE_ENTRY_CANON.md, EVALUATE_GOVERNANCE_ADDENDUM.md, EVALUATE_QA_CHECKLIST.md)
- Webpage Contract Matrix v1.0 (YourWriting row, Required Gates column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] governedEvaluateEntry.js exists and loads all 3 canon docs
- [ ] QA checklist executes with pass/fail result
- [ ] evaluateQuickSubmission calls governedEvaluateEntry BEFORE any LLM calls
- [ ] evaluateFullManuscript calls governedEvaluateEntry BEFORE splitManuscript
- [ ] Checklist violations logged to audit record
- [ ] Evidence: logs show canon docs loaded + QA checklist executed
- [ ] Evidence: test with invalid input shows halted evaluation + error

**Impact:** Critical — blocks promotion to VERIFIED (governance enforcement)

---

### Ticket 7: Complete Parameter Logging (languageVariant, voicePreservation)

**Ticket ID:** RG-EVAL-001-T7  
**Summary:** Ensure languageVariant and voicePreservation are consistently logged in audit record and results  
**Type:** Governance Compliance Task  
**Priority:** P2 (Medium)

**Description:**

Current state: evaluationMode is logged, but languageVariant and voicePreservation are passed but not consistently logged in evaluation results or audit records.

Required:
1. Add languageVariant and voicePreservation to audit record (EvaluationAuditEvent entity)
2. Add languageVariant and voicePreservation to evaluation results stored in Submission and Manuscript entities
3. Ensure UI displays these parameters in evaluation report

**Artifact Links:**
- FUNCTION_INDEX.md (Evaluate → Down-layer controls logged per request)
- Webpage Contract Matrix v1.0 (YourWriting row, Inputs column)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] languageVariant logged to audit record
- [ ] voicePreservation logged to audit record
- [ ] languageVariant stored in evaluation_result JSON (Submission and Manuscript)
- [ ] voicePreservation stored in evaluation_result JSON (Submission and Manuscript)
- [ ] Evidence: query audit record shows all 3 parameters (evaluationMode, languageVariant, voicePreservation)
- [ ] Evidence: ViewReport page displays all 3 parameters

**Impact:** Medium — does not block VERIFIED promotion, but required for full audit compliance

---

## Ticket Dependencies (Jira Blockers)

**Infrastructure Prerequisites (Must Complete First):**
- T2 (Audit Event Entity) BLOCKS → T1, T3, T4, T5, T7
- T6 (Governed Entry Wrapper) BLOCKS → T1, T4, T5

**Normalization Prerequisites:**
- T4 (Refactor evaluateQuickSubmission) BLOCKS → T1, T3
- T5 (Refactor evaluateFullManuscript) BLOCKS → T1, T3

**Dependency Rationale:**
- Audit event entity must exist before validators/SLA can write to it
- Governed entry wrapper must exist before functions can call it
- Refactored functions must exist before instrumentation hooks can be added

---

## Implementation Sequence (Post-Ticket Agreement)

**Phase 1: Infrastructure** (Tickets T2, T6)
- Create EvaluationAuditEvent entity
- Create governedEvaluateEntry.js wrapper

**Phase 2: Normalization** (Tickets T4, T5)
- Refactor evaluateQuickSubmission to call governed modules
- Refactor evaluateFullManuscript to call governed modules

**Phase 3: Instrumentation** (Tickets T1, T3, T7)
- Add validator execution hooks
- Add SLA timing capture
- Complete parameter logging

**Phase 4: Verification** (Walkthrough #1 Rerun)
- Run 500-800 word test with "Chapter" keyword
- Collect evidence (UI screenshots, logs, traces, validator results, audit record)
- Promote to VERIFIED or PARTIALLY VERIFIED based on evidence

---

## Epic Acceptance Criteria

Epic is COMPLETE when:
- [ ] All 7 child tickets are DONE
- [ ] All verification evidence (logs, audit records, screenshots) retained and linked in relevant Jira tickets and/or committed to repository
- [ ] Verification Walkthrough #1 rerun executed with evidence collected
- [ ] Verification Walkthrough #1 shows VERIFIED status (not PARTIALLY VERIFIED or FAILED)
- [ ] Webpage Contract Matrix updated: YourWriting row = VERIFIED with evidence links attached
- [ ] **Phase-4 Gate:** Evidence package includes:
  - UI screenshots (before submit + results page)
  - Logs/traces showing function chain (evaluateQuickSubmission or evaluateFullManuscript → evaluateThirteenCriteria + evaluateSpine + evaluateWaveFlags)
  - Validator execution evidence (EVAL_* validators run with pass/soft/hard + timing)
  - EVALUATE_REQUEST_EVENT audit record with all required fields
  - SLA metrics captured and logged

**No implementation begins until:**
- [ ] All 7 tickets exist in Jira with Epic link
- [ ] All tickets reference Definition of VERIFIED in acceptance criteria
- [ ] All tickets link to FUNCTION_INDEX.md and Webpage Contract Matrix v1.0
- [ ] Ticket dependencies configured in Jira (T2/T6 block T1/T3/T4/T5)
- [ ] Target completion date (2026-01-20) set and acknowledged as governance-blocking

---

**Epic Owner:** Base44 Platform Team  
**Reviewers:** Michael J. Meraw, ChatGPT, Perplexity  
**Type:** Governance-Compliance Remediation (NOT feature development)  
**Timeline:** Target 2026-01-20 (Governance-Blocking Release Gate)  
**Status:** Awaiting Jira configuration confirmation before implementation begins