# Function Spec: evaluateQuickSubmission
**5-Field Contract** | **Phase:** 0 Complete | **Version:** 1.0.0

---

## 1. INPUTS

**Accepted Types:**
- `title`: string (required, 1-200 chars)
- `text`: string (required, 50-3000 words)
- `styleMode`: enum (neutral | staccato | lyrical | documentary | hybrid) - default: neutral
- `final_work_type_used`: string (required, Work Type ID from MDM)
- `detected_work_type`: string (Work Type ID detected by system)
- `detection_confidence`: enum (low | medium | high)
- `user_action`: enum (confirm | override)
- `user_provided_work_type`: string (if user_action = override)

**Size Limits:**
- Word count: 50-3000 (enforced by matrixPreflight)
- Input scale: paragraph | scene | chapter (determined by word count)
- Max confidence cap: varies by input scale (40-75%)

**Visible Ingestion:**
- YourWriting page shows word count in real-time
- Preflight validation results shown before submission
- Work Type detection modal requires user confirmation
- No silent parsing—all validation results surfaced to user

**Validation at Entry:**
- matrixPreflight MUST execute before LLM call
- Work Type routing MUST be confirmed before evaluation
- If input < 50 words: hard fail with "INSUFFICIENT_INPUT"
- If input > 3000 words: hard fail with redirect to full manuscript flow

---

## 2. ROUTING

**Pipeline Selection:**
- 50-3000 words → `evaluateQuickSubmission` (this function)
- 40,000+ words → `evaluateFullManuscript`
- Between 3000-40000 words → user prompted to choose (default: full manuscript)

**Work Type Routing:**
1. `detectWorkType` runs on input text
2. User shown detection result + confidence
3. User confirms or overrides
4. `validateWorkTypeMatrix` builds criteria plan
5. Evaluation proceeds with criteria filtering based on Work Type

**Routing Logic:**
```
IF wordCount < 50 THEN BLOCK (INSUFFICIENT_INPUT)
IF wordCount > 3000 THEN REDIRECT (full manuscript flow)
IF final_work_type_used is NULL THEN BLOCK (confirm_work_type)
ELSE proceed to quick evaluation
```

---

## 3. VALIDATION

**Hard Fails (Block Execution):**
- Input < 50 words
- Input > 3000 words
- Work Type not confirmed
- matrixPreflight rejects input (SCOPE_INSUFFICIENT)
- User not authenticated

**Soft Fails (Warn but Proceed):**
- Detection confidence = "low" (user warned, can override)
- Input at boundary thresholds (e.g., 49-51 words, 2999-3001 words)

**Validation Sequence:**
1. Auth check (401 if fails)
2. Parse request JSON (400 if malformed)
3. matrixPreflight (422 if blocked)
4. Work Type confirmation (400 if missing)
5. Criteria plan validation (422 if invalid)

**Visibility:**
- All validation failures return standardized refusal response
- Refusal includes: status, code, user_message, refusal_reason, next_action
- Frontend shows validation errors in alert/toast
- matrixPreflight audit logged even on block

---

## 4. OUTPUTS

**Artifact Type:** EvaluationResult (JSON)

**Required Fields:**
- `overallScore`: number (0-10, capped by matrixPreflight)
- `agentVerdict`: string
- `manuscriptTier`: enum (developmental | refinement | professional)
- `agentSnapshot`: object (disabled for NA-locked Work Types)
- `criteria`: array of criterion objects (filtered by Work Type)
- `revisionRequests`: array (filtered—no NA criteria)
- `waveHits`: array (filtered—no NA references)
- `waveGuidance`: object (priorityWaves, nextActions)
- `matrix_preflight`: object (wordCount, inputScale, maxConfidenceAllowed)
- `work_type_routing`: object (final_work_type_used, matrix_version, na_criteria, na_output_gate)

**Format:**
- JSON response with `{ success: true, evaluation: {...}, submissionId: "..." }`
- Success: 200 OK
- Validation block: 422 Unprocessable Entity
- Auth failure: 401 Unauthorized
- Timeout: 408 Request Timeout

**Gating:**
- NA criteria MUST NOT appear in scores or revision requests
- Confidence capped per input scale (paragraph=40%, scene=65%, chapter=75%)
- agentSnapshot disabled if core drivers (conflict, dialogue, worldbuilding) all NA
- All outputs validated against criteria plan before return

**Storage:**
- Saved to `Submission` entity with status="reviewed"
- Audit event created in `EvaluationAuditEvent`

---

## 5. AUDIT

**Required Events:**
- Event: EVAL_QUICK_RUN (success) or EVAL_QUICK_BLOCKED (blocked)
- Entity: EvaluationAuditEvent

**Required Fields:**
```json
{
  "event_id": "evt_{timestamp}_{random}",
  "request_id": "{submission_id or blocked_{timestamp}}",
  "timestamp_utc": "ISO 8601",
  "function_id": "evaluateQuickSubmission",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "user_email": "user@example.com",
  "detected_format": "scene",
  "routed_pipeline": "quick",
  "evaluation_mode": "standard",
  "validators_run": ["matrix_preflight", "work_type_detection", "criteria_plan_builder"],
  "validators_failed": [],
  "failure_codes": [],
  "submission_id": "{id or null}",
  "detected_work_type": "{Work Type ID}",
  "final_work_type_used": "{Work Type ID}",
  "matrix_version": "v1",
  "criteria_plan": {...},
  "matrix_preflight_allowed": true,
  "matrix_compliance": true,
  "llm_invoked": true,
  "llm_invocation_reason": "preflight_passed"
}
```

**Audit on Block:**
- Same fields, but `matrix_preflight_allowed: false`, `llm_invoked: false`
- `validators_failed` includes "matrix_preflight"
- `failure_codes` includes block reason (e.g., "SCOPE_INSUFFICIENT")

**Sentry Integration:**
- Errors captured with context: function, operation, word_count, user_email
- Preflight blocks logged as warnings (not errors)

---

## Canon Reference

- Governed by: `EVALUATE_ENTRY_CANON.md` v1.2
- Phase 1 validation: `PHASE_1_GOVERNANCE_EVIDENCE.md` v1.0
- MDM routing: `validateWorkTypeMatrix` master data v1

---

## Test Coverage

- See: `testMatrixPreflight.js` (Phase 1 acceptance)
- See: `testBirthdayEssayFixture.js` (NA enforcement)
- See: `testWorkTypeRouting.js` (MDM routing)

**Acceptance Criteria:**
✅ Blocks input < 50 words  
✅ Blocks input > 3000 words  
✅ Blocks if Work Type unconfirmed  
✅ Caps confidence per input scale  
✅ Filters NA criteria from output  
✅ Logs audit event with required fields  
✅ Returns standardized refusal on block