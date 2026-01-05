# GOVERNANCE COMPLIANCE EVIDENCE REQUEST
**RevisionGrade™ → Base44 Platform**

Date: 2026-01-05  
Spec Version: 1.0.0  
Status: **EVIDENCE REQUIRED - NON-NEGOTIABLE**  
**Incident:** This evidence is required to close Incident ID **SG-2024-ROUTE-01** and mark Phase 1 matrixPreflight control as operational.

---

## ✅ COMPLIANCE SUMMARY SHEET

**PASS Criteria:** Compliance is **PASS** only if Samples A–E are provided with complete **triad evidence** for each:

1. **API Response** (raw JSON payload returned to client)
2. **Audit Event** (raw JSON from system of record)
3. **Release Trace** (release_id + commit_sha matching code diff)

**Each sample MUST include:**
- Shared `correlation_id` present in API response, audit event, and logs
- Required fields per scenario (see below)
- Evidence from system of record (not screenshots)

**Failure Condition:** Any missing element = **FAIL**. No partial credit.

---

## Global Constants (Frozen per Spec v1.0.0)

```
MIN_WORDS_QUICK = 50
MAX_WORDS_QUICK = 3000
GOVERNANCE_VERSION = "1.0.0"
```

**Input Scale Mapping (per matrixPreflight):**
- <50 words → `null` (invalid)
- 50-249 words → `paragraph`
- 250-1,999 words → `scene`
- 2,000-7,999 words → `chapter`
- 8,000-39,999 words → `multi_chapter`
- 40,000+ words → `full_manuscript`

---

## Purpose
This document formally requests evidence that Base44 has implemented the governance contracts defined in `MASTER_FUNCTION_GOVERNANCE_SPEC.md` version 1.0.0.

**Governance Position:**
- Spec defines WHAT must happen (frozen, canonical)
- Base44 implements HOW it happens (runtime code)
- Evidence proves runtime matches spec (compliance)

Without evidence, there is no compliance—only narration.

---

## REQUIRED EVIDENCE BUNDLE

Base44 MUST provide the following three categories of evidence to demonstrate compliance with `MASTER_FUNCTION_GOVERNANCE_SPEC.md` v1.0.0:

### 1. CODE CHANGES (Diff/Pull Request)

**Requirement:** Provide a diff or pull request link showing all code changes made to implement governance v1.0.0.

**Must include changes to:**
- `functions/utils/governanceVersion.js` (or equivalent centralized version constant)
- `functions/evaluateQuickSubmission.js` (governance version emission)
- `functions/MASTER_FUNCTION_GOVERNANCE_SPEC.md` (spec itself, if updated)
- Any other functions that emit `EvaluationAuditEvent` or similar audit entities

**Required in diff:**
```javascript
// Example evidence markers in code:
export const GOVERNANCE_VERSION = "1.0.0";
export const SPEC_HASH = "sha256:abc123..."; // or canon_hash_bundle

// In audit event creation:
governance_version: GOVERNANCE_VERSION,
spec_hash: SPEC_HASH,
canon_hash: CANON_HASHES.EVALUATE_ENTRY_CANON,
function_id: 'evaluateQuickSubmission',
release_id: RELEASE_ID,
commit_sha: COMMIT_SHA,
environment: ENVIRONMENT,
correlation_id: correlationId
```

**Acceptance Criteria:**
- [ ] Diff shows `governance_version` constant added
- [ ] Diff shows `spec_hash` or `canon_hash_bundle` added (uniquely identifies spec content)
- [ ] Diff shows `governance_version` + `spec_hash` emitted in audit events
- [ ] Diff shows `release_id`, `commit_sha`, `environment`, `correlation_id` emitted in audit events
- [ ] Diff shows standardized refusal response builder with required `next_action` field
- [ ] Diff shows word threshold enforcement (50-3,000 hard cap)
- [ ] Diff is linked to a specific commit SHA or build version

**Format:** GitHub/GitLab PR link, or inline diff with commit reference

---

### 2. RUNTIME EVIDENCE (Logs + API Responses)

**Requirement:** Provide raw JSON audit event logs AND raw API response payloads from production (or staging) for five specific scenarios.

**Critical Requirements:**
- **Logs MUST be copied directly from the system of record** (e.g., Sentry event payload, structured log store, database audit table export). Screenshots alone are not acceptable evidence.
- **Each scenario MUST include a shared correlation key** (`correlation_id`, `request_id`, `submission_id` where applicable) present in: (a) API response JSON, (b) audit event JSON, and (c) server logs/Sentry breadcrumbs where applicable.
- **For scenarios claiming `llm_invoked: false`**, Base44 MUST provide evidence that no model call occurred (e.g., absence of LLM provider request log entry for the correlation_id, or explicit `llm_call_skipped_reason` field in audit event).

---

#### Sample A: Preflight Block
**Scenario:** Quick evaluation submission with <MIN_WORDS_QUICK words (below minimum: <50 words)

**Required audit log:**
```json
{
  "event_id": "evt_...",
  "correlation_id": "corr_abc123",
  "request_id": "blocked_abc123",
  "timestamp_utc": "2026-01-05T...",
  "function_id": "evaluateQuickSubmission",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "spec_hash": "sha256:def456...",
  "release_id": "v2026.01.05-001",
  "commit_sha": "abc123def456...",
  "environment": "production",
  "service": "revisiongrade",
  "user_email": "test@example.com",
  "detected_format": "scene",
  "routed_pipeline": "quick",
  "validators_run": ["matrix_preflight"],
  "validators_failed": ["matrix_preflight"],
  "failure_codes": ["SCOPE_INSUFFICIENT"],
  "matrix_preflight_allowed": false,
  "matrix_compliance": false,
  "llm_invoked": false,
  "llm_call_skipped_reason": "preflight_blocked",
  "input_word_count": 42,
  "input_scale": null,
  "max_confidence_allowed": 0
}
```

**Required API response payload:**
```json
{
  "correlation_id": "corr_abc123",
  "status": "blocked",
  "code": "INSUFFICIENT_INPUT",
  "user_message": "❌ INSUFFICIENT INPUT: Too short (42 words). Minimum 50 words required",
  "developer_message": null,
  "refusal_reason": "SCOPE_INSUFFICIENT",
  "next_action": "upload_more"
}
```

**Required LLM non-invocation evidence:**
- Absence of LLM provider request log for `correlation_id: corr_abc123`
- OR explicit statement: "No OpenAI/LLM API calls found for correlation_id"

**Acceptance Criteria:**
- [ ] Log shows `governance_version: "1.0.0"` AND `spec_hash`
- [ ] Log shows `llm_invoked: false` with `llm_call_skipped_reason`
- [ ] Log shows `matrix_preflight_allowed: false`
- [ ] Log includes `correlation_id` matching API response
- [ ] Log includes `release_id` AND `commit_sha`
- [ ] Log includes `environment` field
- [ ] API response includes standardized refusal schema fields
- [ ] API response includes required `next_action` field (one of: `upload_more`, `switch_flow`, `change_work_type`, `contact_support`, `retry_later`)
- [ ] API response does NOT claim analysis occurred (anti-hallucination: no "We reviewed your manuscript" text when blocked)
- [ ] `llm_invoked: false` matches both response and audit
- [ ] Evidence of LLM non-invocation provided (log absence or explicit statement)
- [ ] Log includes all required audit fields from spec

---

#### Sample B: Quick Eval Allowed
**Scenario:** Quick evaluation submission with 500 words (within range: 50-3,000 words)

**Required audit log:**
```json
{
  "event_id": "evt_...",
  "correlation_id": "corr_xyz789",
  "request_id": "req_xyz789",
  "submission_id": "sub_xyz789",
  "timestamp_utc": "2026-01-05T...",
  "function_id": "evaluateQuickSubmission",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "spec_hash": "sha256:def456...",
  "release_id": "v2026.01.05-001",
  "commit_sha": "abc123def456...",
  "environment": "production",
  "service": "revisiongrade",
  "user_email": "test@example.com",
  "detected_format": "scene",
  "routed_pipeline": "quick",
  "validators_run": ["matrix_preflight", "work_type_detection", "criteria_plan_builder"],
  "validators_failed": [],
  "failure_codes": [],
  "matrix_preflight_allowed": true,
  "matrix_compliance": true,
  "llm_invoked": true,
  "llm_invocation_reason": "preflight_passed",
  "input_word_count": 500,
  "input_scale": "scene",
  "max_confidence_allowed": 65,
  "final_work_type_used": "contemporary_fiction",
  "matrix_version": "v1.0.0"
}
```

**Required API response payload:**
```json
{
  "correlation_id": "corr_xyz789",
  "success": true,
  "submission_id": "sub_xyz789",
  "evaluation": {
    "overallScore": 6.5,
    "matrix_preflight": {
      "maxConfidenceAllowed": 65,
      "confidenceCapped": false
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Log shows `governance_version: "1.0.0"` AND `spec_hash`
- [ ] Log shows `llm_invoked: true`
- [ ] Log shows `matrix_preflight_allowed: true`
- [ ] Log shows confidence cap applied (max 65 for scene)
- [ ] Log includes `correlation_id` matching API response and `submission_id`
- [ ] Log includes `release_id` AND `commit_sha`
- [ ] Log includes `environment` field
- [ ] Log includes work type routing fields

---

#### Sample C: NA Gating Case
**Scenario:** Quick evaluation for a work type with NA criteria (e.g., birthday essay with dialogue=NA)

**Required audit log:**
```json
{
  "event_id": "evt_...",
  "correlation_id": "corr_na123",
  "request_id": "req_na123",
  "submission_id": "sub_na123",
  "timestamp_utc": "2026-01-05T...",
  "function_id": "evaluateQuickSubmission",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "spec_hash": "sha256:def456...",
  "release_id": "v2026.01.05-001",
  "commit_sha": "abc123def456...",
  "environment": "production",
  "service": "revisiongrade",
  "user_email": "test@example.com",
  "detected_format": "scene",
  "routed_pipeline": "quick",
  "matrix_preflight_allowed": true,
  "matrix_compliance": true,
  "llm_invoked": true,
  "final_work_type_used": "birthday_essay",
  "matrix_version": "v1.0.0",
  "criteria_plan": {
    "dialogue": { "status": "NA", "blockingEnabled": false },
    "conflict": { "status": "NA", "blockingEnabled": false },
    "worldbuilding": { "status": "NA", "blockingEnabled": false }
  }
}
```

**Required API response payload (evaluation output):**
```json
{
  "correlation_id": "corr_na123",
  "success": true,
  "submission_id": "sub_na123",
  "evaluation": {
    "overallScore": 7.5,
    "agentSnapshot": null,
    "criteria": [
      { "criterion_id": "voice", "score": 8, ... },
      { "criterion_id": "linePolish", "score": 7, ... }
    ],
    "revisionRequests": [
      { "criterion_id": "voice", "priority": "Medium", ... }
    ],
    "work_type_routing": {
      "final_work_type_used": "birthday_essay",
      "na_criteria": ["dialogue", "conflict", "worldbuilding"],
      "na_output_gate": {
        "enforcement_active": true,
        "agentSnapshot_disabled": true,
        "agentSnapshot_disabled_reason": "Agent snapshot disabled: core narrative drivers (conflict, dialogue, worldbuilding) are NA for birthday_essay"
      }
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Log shows `governance_version: "1.0.0"` AND `spec_hash`
- [ ] Log shows `correlation_id` matching API response and `submission_id`
- [ ] Log shows `release_id` AND `commit_sha`
- [ ] Log shows `environment` field
- [ ] Log shows NA criteria in `criteria_plan`
- [ ] API response shows `agentSnapshot: null`
- [ ] API response shows NA criteria absent from `criteria` array
- [ ] API response shows no revision requests referencing NA criteria
- [ ] API response text does not reference NA criteria (dialogue, conflict, worldbuilding)

---

#### Sample D: Unsupported File Type (Silent Ingestion Prohibited)
**Scenario:** User uploads unsupported file type (.png, .zip, .exe, etc.)

**Required audit log:**
```json
{
  "event_id": "evt_...",
  "correlation_id": "corr_file123",
  "request_id": "blocked_file123",
  "timestamp_utc": "2026-01-05T...",
  "function_id": "evaluateQuickSubmission",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "spec_hash": "sha256:def456...",
  "release_id": "v2026.01.05-001",
  "commit_sha": "abc123def456...",
  "environment": "production",
  "service": "revisiongrade",
  "user_email": "test@example.com",
  "detected_format": "unknown",
  "routed_pipeline": "quick",
  "validators_run": ["file_type_validator"],
  "validators_failed": ["file_type_validator"],
  "failure_codes": ["INVALID_FILE_TYPE"],
  "matrix_preflight_allowed": false,
  "matrix_compliance": false,
  "llm_invoked": false,
  "llm_call_skipped_reason": "file_type_invalid",
  "file_type": ".png",
  "supported_types": [".docx", ".txt", ".pdf"]
}
```

**Required API response payload:**
```json
{
  "correlation_id": "corr_file123",
  "status": "blocked",
  "code": "INVALID_FILE_TYPE",
  "user_message": "File type .png is not supported. Supported formats: .docx, .txt, .pdf",
  "refusal_reason": "INVALID_FILE_TYPE",
  "next_action": "upload_supported_format"
}
```

**Required UI evidence:**
- Screenshot or HTML snippet showing user-visible error message
- Error MUST be visible to user (not silent fail)

**Acceptance Criteria:**
- [ ] Log shows `governance_version: "1.0.0"` AND `spec_hash`
- [ ] Log shows `llm_invoked: false` with `llm_call_skipped_reason`
- [ ] Log shows `validators_failed: ["file_type_validator"]`
- [ ] Log includes `correlation_id` matching API response
- [ ] Log includes `release_id` AND `commit_sha`
- [ ] Log includes `environment` field
- [ ] API response includes standardized refusal schema with required `next_action`
- [ ] API response does NOT claim analysis occurred (anti-hallucination check)
- [ ] UI screenshot shows user-visible error (no silent ingestion)

---

#### Sample E: Routing Boundary Test (Quick → Full)
**Scenario:** Input just above quick cap (e.g., 3,001 words) → must route to full manuscript pipeline

**Required audit log:**
```json
{
  "event_id": "evt_...",
  "correlation_id": "corr_route123",
  "request_id": "route_abc123",
  "timestamp_utc": "2026-01-05T...",
  "function_id": "evaluateQuickSubmission",
  "canon_hash": "EVALUATE_ENTRY_CANON_v1.2",
  "governance_version": "1.0.0",
  "spec_hash": "sha256:def456...",
  "release_id": "v2026.01.05-001",
  "commit_sha": "abc123def456...",
  "environment": "production",
  "service": "revisiongrade",
  "user_email": "test@example.com",
  "detected_format": "chapter",
  "routed_pipeline": "quick",
  "validators_run": ["matrix_preflight"],
  "validators_failed": ["matrix_preflight"],
  "failure_codes": ["REDIRECT_REQUIRED"],
  "matrix_preflight_allowed": false,
  "matrix_compliance": false,
  "llm_invoked": false,
  "llm_call_skipped_reason": "input_exceeds_quick_cap",
  "input_word_count": 3001,
  "input_scale": "chapter",
  "max_confidence_allowed": 75,
  "redirect_to_pipeline": "full_manuscript"
}
```

**Required API response payload:**
```json
{
  "correlation_id": "corr_route123",
  "status": "blocked",
  "code": "REDIRECT_REQUIRED",
  "user_message": "Your submission (3,001 words) exceeds the quick evaluation limit (3,000 words). Please use the full manuscript upload for comprehensive analysis.",
  "refusal_reason": "SCOPE_EXCEEDED",
  "next_action": "switch_flow",
  "redirect_target": "full_manuscript_upload"
}
```

**Acceptance Criteria:**
- [ ] Log shows `governance_version: "1.0.0"` AND `spec_hash`
- [ ] Log shows `input_word_count: 3001` (just above MAX_WORDS_QUICK)
- [ ] Log shows `routed_pipeline: "quick"` (original request)
- [ ] Log shows `redirect_to_pipeline: "full_manuscript"` (enforcement)
- [ ] Log shows `llm_invoked: false` with `llm_call_skipped_reason`
- [ ] Log includes `correlation_id` matching API response
- [ ] Log includes `release_id` AND `commit_sha`
- [ ] API response includes `code: "REDIRECT_REQUIRED"`
- [ ] API response includes `next_action: "switch_flow"`
- [ ] API response explicitly instructs user to use full manuscript flow

---

### 3. RELEASE IDENTIFIER (Deployment Traceability)

**Requirement:** Provide a release identifier that ties the above evidence to a specific deployed version.

**Must include:**
- **Commit SHA** (e.g., `abc123def456...`)
- **Build version** (e.g., `v2024.01.05-001`)
- **Release tag** (e.g., `governance-v1.0.0`)
- **Spec hash** (sha256 hash of `MASTER_FUNCTION_GOVERNANCE_SPEC.md` v1.0.0 content)

**Evidence format:**
```
Release: v2024.01.05-001
Commit: abc123def456789...
Spec Hash: sha256:def456789abc...
Environment: production
Deployed to: production
Deployed at: 2026-01-05T14:30:00Z
```

**Acceptance Criteria:**
- [ ] Release identifier is visible in production logs (e.g., as a log field)
- [ ] Release identifier matches the code diff/PR
- [ ] Spec hash matches content of `MASTER_FUNCTION_GOVERNANCE_SPEC.md` v1.0.0
- [ ] Release identifier can be used to retrieve exact code state from version control

---

## COMPLIANCE CHECKLIST

Base44 MUST provide ALL of the following to demonstrate compliance:

### Code Evidence
- [ ] Diff/PR link showing governance version constant added
- [ ] Diff/PR link showing spec_hash constant added (uniquely identifies spec content)
- [ ] Diff/PR link showing governance version + spec_hash emitted in audit events
- [ ] Diff/PR link showing `release_id`, `commit_sha`, `environment`, `correlation_id` fields added
- [ ] Diff/PR link showing standardized refusal responses with required `next_action` enum
- [ ] Diff/PR link showing anti-hallucination checks (no "We analyzed..." when blocked)
- [ ] Diff/PR link showing word threshold enforcement (50-3,000)
- [ ] Code changes linked to specific commit SHA

### Log Evidence (Triad for each sample: API + Audit + Trace)
- [ ] Sample A: Preflight block log + API response + LLM non-invocation evidence
- [ ] Sample B: Quick eval allowed log + correlation evidence
- [ ] Sample C: NA gating log + API response showing scrubbing
- [ ] Sample D: Unsupported file type log + API response + UI screenshot
- [ ] Sample E: Routing boundary log + API response showing redirect
- [ ] All logs include `governance_version: "1.0.0"` AND `spec_hash`
- [ ] All logs include `release_id` AND `commit_sha` fields
- [ ] All logs include `environment` field
- [ ] All logs include `correlation_id` matching API responses
- [ ] All logs copied from system of record (not screenshots)
- [ ] All API responses include required `next_action` field (for refusals)
- [ ] All API responses pass anti-hallucination check (no false analysis claims)
- [ ] All logs include required audit fields per spec

### Deployment Evidence
- [ ] Release identifier provided (commit SHA + build version)
- [ ] Spec hash provided (sha256 of governing spec)
- [ ] Release identifier matches code diff
- [ ] Release identifier visible in production logs
- [ ] Deployment timestamp provided

---

## SUBMISSION INSTRUCTIONS

**Requested By:** 2026-01-08 (non-binding; used for prioritization and incident closure)

**Environment:** Production preferred; staging acceptable if production cannot safely exercise these scenarios, **provided staging logs include identical field structure**.

**PII Redaction Policy:**
- PII may be redacted **ONLY in values, not keys/fields**
- All required field names **MUST remain present**
- Example: `"user_email": "redacted@example.com"` is acceptable
- Example: removing the `user_email` field entirely is **NOT acceptable**

**Delivery Method:**
1. Create a new file: `functions/GOVERNANCE_COMPLIANCE_EVIDENCE_v1.0.0.md`
2. Include all three evidence categories above
3. For log samples: paste raw JSON copied from system of record (Sentry, log store, DB export)
4. For API responses: paste raw response payloads with `correlation_id`
5. For code changes: provide GitHub/GitLab PR link or inline diff
6. For release ID: provide commit SHA, build version, spec hash, and deployment timestamp

**File structure:**
```markdown
# GOVERNANCE COMPLIANCE EVIDENCE v1.0.0

## 1. Code Changes
[Diff/PR link or inline diff]

## 2. Runtime Evidence (Triad: API + Audit + Trace)

### Sample A: Preflight Block
**Audit Log (from system of record):**
[Raw JSON]

**API Response:**
[Raw JSON]

**LLM Non-Invocation Evidence:**
[Log absence proof or explicit statement]

### Sample B: Quick Eval Allowed
**Audit Log:**
[Raw JSON]

**API Response:**
[Raw JSON showing correlation_id]

### Sample C: NA Gating
**Audit Log:**
[Raw JSON]

**API Response (evaluation output):**
[Raw JSON showing agentSnapshot: null and NA scrubbing]

### Sample D: Unsupported File Type
**Audit Log:**
[Raw JSON]

**API Response:**
[Raw JSON with next_action]

**UI Screenshot:**
[Screenshot or HTML snippet showing user-visible error]

### Sample E: Routing Boundary (Quick → Full)
**Audit Log:**
[Raw JSON]

**API Response:**
[Raw JSON showing redirect instruction]

## 3. Release Identifier
Commit: [SHA]
Release: [version]
Spec Hash: [sha256 of spec v1.0.0]
Environment: [production/staging]
Deployed: [timestamp]
```

---

## FAILURE CONDITIONS

If any of the following are missing, compliance is **FAILED**:

❌ **No `governance_version` field in logs** → Cannot prove which spec was in force  
❌ **No `spec_hash` field in logs** → Cannot prove spec content identity (version alone insufficient)  
❌ **No `release_id` or `commit_sha` in logs** → Cannot tie evidence to deployed code  
❌ **No `environment` field in logs** → Cannot verify production/staging provenance  
❌ **No `correlation_id` linking API response + audit event** → Cannot verify evidence came from same request  
❌ **No code diff** → Cannot verify implementation matches spec  
❌ **Logs missing required fields** → Spec not fully implemented  
❌ **Evidence not from production/staging** → Theoretical compliance only  
❌ **Logs provided as screenshots** → Not verifiable (must be from system of record)  
❌ **Log samples showing HTTP 404/500** → Treated as runtime non-compliance with spec, not as missing evidence  
❌ **API responses missing from Sample A/C/D/E** → Cannot prove refusal/scrubbing/routing behavior  
❌ **No UI screenshot for Sample D** → Cannot prove "no silent ingestion"  
❌ **PII redaction removes field names** → Evidence structure destroyed  
❌ **Refusal responses missing `next_action` field** → Schema non-compliant  
❌ **Refusal responses claim analysis when `llm_invoked: false`** → Anti-hallucination violation  
❌ **No LLM non-invocation evidence for `llm_invoked: false` cases** → Cannot verify claim  
❌ **Missing Sample E (routing boundary)** → Cannot prove correct pipeline enforcement  

**Without evidence, there is no compliance—only narration.**

---

## GOVERNANCE POSITION

### If Base44 Provides Complete Evidence
✅ Governance accepts compliance  
✅ Spec v1.0.0 is enforced in production  
✅ Incident SG-2024-ROUTE-01 closed  
✅ Future audits reference this evidence bundle  

### If Base44 Provides Incomplete Evidence
⚠️ Governance documents gaps  
⚠️ Base44 must fix gaps within 48 hours  
⚠️ Spec remains authoritative; runtime is non-compliant  
⚠️ Incident remains open  

### If Base44 Does Not Provide Evidence
❌ Governance assumes non-compliance  
❌ Spec v1.0.0 remains frozen and authoritative  
❌ Base44 must implement BEFORE claiming compliance  
❌ Incident escalated to stakeholders  

---

## CONTACT

**Governance Owner:** RevisionGrade Product Team  
**Platform Owner:** Base44 Engineering  
**Escalation:** If evidence is not provided by deadline, escalate to project stakeholders

---

**END OF EVIDENCE REQUEST**