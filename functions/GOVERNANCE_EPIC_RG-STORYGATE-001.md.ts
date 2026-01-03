# JIRA EPIC — GOVERNANCE ENFORCEMENT (MANDATORY)

## Epic ID
**RG-STORYGATE-001**

## Epic Name
**Storygate Governance & Verification Enforcement — Marketplace, Studio, Verification**

## Type
Governance-Compliance Remediation (Release-Blocking)

## Status
**PLANNED — BLOCKED (No Implementation Authorized)**

## Target Completion
**2026-02-10 (Tuesday) — Hard VERIFIED Deadline (Release Gate)**

Failure to meet this deadline makes Storygate release-blocking.

**Created:** 2026-01-03

---

## Epic Purpose (Non-Negotiable)

**This Epic enforces existing, accepted governance doctrine across all Storygate surfaces:**

- StoryGate Marketplace (browse / discover)
- StorygateStudio (creation / management)
- CreatorStoryGate (access control)
- IndustryVerification (admin verification)

FUNCTION TEST #6 confirmed that while Storygate functionality exists, governance enforcement, auditability, validator execution, and SLA evidence are incomplete or absent.

**This Epic does not redesign Storygate.**  
**It enforces governance obligations Base44 has already accepted.**

Failure to comply results in FAILED status and release blocking.

---

## Governing Authority (Hierarchy — LOCKED)

All work under this Epic is governed by, in order:

1. **PLATFORM_GOVERNANCE_DOCTRINE.md** (RevisionGrade governance foundation)
2. **Definition of VERIFIED** (acceptance gate standard)
3. **Webpage Contract Matrix** (Storygate rows)
4. **FUNCTION_INDEX.md** (authoritative registry)
5. **STORYGATE_FLOW_MAP.md** (canonical workflow)
6. **STORYGATE_STUDIO_DESIGN_SYSTEM.md** (canonical design)
7. **BASE44_CONTRACT_ADDENDUM.md** (governance obligations)
8. **QA_ENFORCEMENT_CHECKLIST.md** (evidence requirements)
9. **RG-STORYGATE-001** (this Epic)

If any artifact conflicts with the above, it is invalid.

---

## Current Compliance Status

**PARTIALLY VERIFIED — Functionality Correct, Governance Hooks Missing**

### Evidence (from FUNCTION TEST #6)

**What Works:**
- ✅ Listing creation and persistence (StorygateSubmission, ProjectListing entities)
- ✅ Access control enforcement (visibility checks, unlock workflow, ownership validation)
- ✅ Verification system (admin-only, state updates, verified badge logic)
- ✅ Access logging (AccessLog entity tracks all actions)
- ✅ Negative path handling (inline validation blocks invalid inputs)

**What's Missing (Governance Layer):**
- ❌ No `governedEvaluateEntry` wrapper
- ❌ No validator modules (validation is inline, scattered across UI + backend)
- ❌ No structured audit events (AccessLog used, but missing governance fields)
- ❌ No SLA timing metrics
- ❌ No structured error codes (generic messages only)

**Verdict:** Storygate surface behaves correctly per STORYGATE_FLOW_MAP.md and access control requirements, but lacks the governance enforcement layer (governed entry, validators, EvaluationAuditEvent audit, SLA) required for VERIFIED status.

---

## Explicit Constraints (Must Be Restated in Jira)

1. **No implementation may begin without explicit phase authorization.**
2. **No wiring, refactoring, or runtime changes during verification walkthroughs.**
3. **Any governance bypass triggers GOVERNANCE_BYPASS incident.**
4. **Acceptance decisions are evidence-based only.**
5. **Access-control bypass = FAILED (Security Risk).**

---

## Phase 0 — Governance Alignment Confirmation (MANDATORY)

**Before Phase 1 (Dependencies) may begin, Base44 must explicitly confirm the following in Jira comments or acknowledgment notes:**

### Validator Alignment
Confirm whether the following validators already exist, or identify their canonical equivalents:
- `STORYGATE_REQUIRED_FIELDS`
- `STORYGATE_VISIBILITY_RULES`
- `STORYGATE_ACCESS_CONTROL`
- `STORYGATE_VERIFICATION_STATE`

**If equivalents exist:** Cite their exact names and locations.  
**If any do not exist:** Base44 must flag this and create explicit design tickets before implementation begins.

### Audit Schema Compatibility
Confirm that the required Storygate audit fields are supported by the existing `EvaluationAuditEvent` schema (or a superset).

**Required fields:** `event_id`, `request_id`, `timestamp_utc`, `action_type`, `listing_id`, `creator_id`, `requester_id`, `access_granted`, `verification_state`, `validators_run`, `validators_failed`, `failure_codes`, `canon_hash`

**If any required fields are missing** (e.g., `listing_id`, `access_granted`, `verification_state`), Base44 must:
- Explicitly enumerate the delta
- Create a schema extension ticket prior to Phase 2

### Governed Entry Pattern Confirmation
Confirm that Storygate will use the same governed entry enforcement pattern established in RG-EVAL Epics.

Cite the existing implementation or reference document.

**If no such pattern exists:** Base44 must flag this as a design gap before proceeding.

---

**No implementation work is authorized until all three confirmations are complete.**

**Failure to confirm constitutes a Phase-0 block and schedule risk owned by Base44.**

---

## Definition of VERIFIED (Acceptance Gate — Storygate-Specific)

Storygate may be promoted to **VERIFIED** only if all conditions below are evidenced:

### ✅ Listing Creation & Persistence
- Listings created successfully
- Metadata persisted and retrievable
- Listings discoverable only when permitted
- **Evidence:** Query ProjectListing entity shows created listings

### ✅ Access Control Enforcement
- Public listings discoverable
- Private listings blocked
- Access requests required and enforced
- No permission bypass possible
- **Evidence:** Negative path tests blocked; validator evidence present

### ✅ Verification Enforcement
- Verification state admin-controlled
- Verified badge reflects real state
- Verification changes auditable
- **Evidence:** Verification state changes logged with audit event

### ✅ Governed Entry
- Governed entry executes before any Storygate state change
- QA checklist enforced
- Halt-on-fail behavior exists
- **Evidence:** Traces show governed entry execution

### ✅ Validators Executed
**Required validators (minimum):**
- STORYGATE_REQUIRED_FIELDS
- STORYGATE_VISIBILITY_RULES
- STORYGATE_ACCESS_CONTROL
- STORYGATE_VERIFICATION_STATE

Results logged (pass / soft / hard).  
**Evidence:** Audit record includes `validators_run`, `validators_failed`, `failure_codes`

### ✅ Audit Record Written
**For every state-changing action:**
- `create_listing`
- `request_access`
- `grant_access`
- `deny_access`
- `verify_creator`

A structured audit event must exist (not logs).

**Required fields:**
- `event_id`, `request_id`, `timestamp_utc`
- `action_type`
- `listing_id`, `creator_id`, `requester_id` (context)
- `access_granted` (true/false)
- `verification_state` (verified/unverified)
- `validators_run`, `validators_failed`, `failure_codes`
- `canon_hash` / version

**Evidence:** Query audit entity shows structured records for all actions

### ✅ SLA Timing Captured
- `start_ms`, `end_ms`, `elapsed_ms`
- Operations array where applicable
- **Evidence:** SLA metrics present in audit record

### ✅ Negative Path Enforcement
- Invalid requests blocked
- User-visible error
- Failure auditable
- **Evidence:** Invalid input test shows block + validator failure + audit event

**If any condition is missing → UNVERIFIED or FAILED.**  
**Access-control bypass → FAILED (Security Risk).**

---

## Governance Gaps (Evidence from FUNCTION TEST #6)

| Gap | Evidence | Severity | Violation Type |
|-----|----------|----------|----------------|
| G1: No governed entry | No Storygate function calls governedEvaluateEntry | 🔴 CRITICAL | Infrastructure missing |
| G2: No validators | Validation is inline only (no validator modules) | 🔴 CRITICAL | Enforcement missing |
| G3: Non-standard audit | AccessLog exists but missing governance fields | 🔴 CRITICAL | Auditability incomplete |
| G4: No SLA metrics | No timing capture in any Storygate function | 🟡 HIGH | Performance tracking missing |
| G5: No structured error codes | Generic messages ("Title is required"), not ERR_STORYGATE_* | 🟡 MEDIUM | Error handling informal |
| G6: Scattered validation | UI + backend validation not centralized | 🟡 MEDIUM | Maintainability risk |

---

## Required Child Tickets (MANDATORY)

### RG-STORYGATE-001-T8 — Governance Dependency Check
**Priority:** P0 (Blocks All Other Work)  
**Type:** Infrastructure

**Description:**

Before any wiring or validator implementation can begin, confirm that governance infrastructure dependencies are complete.

**Required:**
- Verify `entities/EvaluationAuditEvent.json` exists (or confirm Storygate audit schema)
- Verify `functions/governedEvaluateEntry.js` exists and tested
- Verify RG-EVAL-001-T2 marked DONE (audit entity)
- Verify RG-EVAL-001-T6 marked DONE (governed entry wrapper)
- Confirm Phase-0 alignment (validators, audit schema, governed entry pattern)
- No wiring begins until confirmation complete

**Artifact Links:**
- RG-EVAL-001 Epic (dependency source)
- `FUNCTION_INDEX.md` (infrastructure requirements)
- Phase-0 alignment confirmations (validator names, audit schema, governed entry pattern)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `EvaluationAuditEvent` entity exists and supports Storygate fields
- [ ] `governedEvaluateEntry` function exists and tested
- [ ] RG-EVAL-001-T2 status = DONE (evidence attached)
- [ ] RG-EVAL-001-T6 status = DONE (evidence attached)
- [ ] Phase-0 alignment confirmed (all three confirmations complete)
- [ ] Confirmation documented in Epic notes

**Impact:** CRITICAL — blocks all other tickets

---

### RG-STORYGATE-001-T1 — Governed Entry Enforcement
**Priority:** P0 (Blocks Verification)  
**Type:** Critical Governance

**Description:**

Current state: No Storygate function calls `governedEvaluateEntry`. QA checklist not enforced.

**Required:**
- All Storygate state-changing actions must execute through governed entry before any processing
- `governedEvaluateEntry` validates input against QA checklist
- Only if validation passes, proceed to listing creation / access grant / verification
- If validation fails, halt and return error with checklist violations

**Affected Functions:**
- `submitStoryGateFilm.js`
- `createStoryGateListing.js`
- `requestProjectAccess.js`
- `handleAccessRequest.js`
- `handleVerification.js`

**Artifact Links:**
- `FUNCTION_INDEX.md` (Storygate → Runtime → governedEvaluateEntry.js)
- Webpage Contract Matrix (Storygate rows, Required Gates column)
- RG-EVAL-001 governed entry pattern

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] All Storygate functions call `governedEvaluateEntry` before processing
- [ ] `governedEvaluateEntry` loads and executes QA checklist
- [ ] If checklist fails, returns error and halts
- [ ] If checklist passes, proceeds to action
- [ ] Evidence: logs show `governedEvaluateEntry` call + QA checklist result for all actions
- [ ] Evidence: test with invalid input shows halted flow + error

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-STORYGATE-001-T2 — Validator Execution (Access & Verification)
**Priority:** P0 (Blocks Verification)  
**Type:** Critical Governance

**Description:**

Current state: Validation is inline only (no validator modules). Validation logic scattered across UI + backend.

**Required:**

Implement and execute Storygate validators (minimum):
- **STORYGATE_REQUIRED_FIELDS:** Validate field completeness (title, logline, genre, etc.)
- **STORYGATE_VISIBILITY_RULES:** Validate visibility state transitions (private → discoverable → restricted)
- **STORYGATE_ACCESS_CONTROL:** Validate permission checks (ownership, industry verification, unlock status)
- **STORYGATE_VERIFICATION_STATE:** Validate verification state (admin-only, state persistence)

Each validator:
- **Input:** request data + current state
- **Output:** pass/fail + failure codes + remediation suggestions
- Invoked before state change
- Logs validation result to audit record

**Artifact Links:**
- `STORYGATE_FLOW_MAP.md` (access control canonical rules)
- `STORYGATE_STUDIO_DESIGN_SYSTEM.md` (verification requirements)
- Webpage Contract Matrix (Storygate rows)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] STORYGATE_REQUIRED_FIELDS validator exists and executes
- [ ] STORYGATE_VISIBILITY_RULES validator exists and executes
- [ ] STORYGATE_ACCESS_CONTROL validator exists and executes
- [ ] STORYGATE_VERIFICATION_STATE validator exists and executes
- [ ] All validators return pass/fail + failure codes
- [ ] Validators invoked before state changes
- [ ] Evidence: logs show validator execution + results for all action types
- [ ] Evidence: `validators_run` and `validators_failed` populated in audit records

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-STORYGATE-001-T3 — Structured Audit Event Creation (All Storygate Actions)
**Priority:** P0 (Blocks Verification)  
**Type:** Critical Governance

**Description:**

Current state: AccessLog entity exists but missing governance fields (validators_run, failure_codes, canon_hash). Not in EvaluationAuditEvent governance format.

**Required:**

Emit a structured audit event (not free-text logs) for every Storygate state-changing action:
- `create_listing`
- `request_access`
- `grant_access`
- `deny_access`
- `verify_creator`

**Required fields (minimum):**
- `event_id`, `request_id`, `timestamp_utc`
- `action_type` (create_listing | request_access | grant_access | deny_access | verify_creator)
- `listing_id`, `creator_id`, `requester_id` (actor context)
- `access_granted` (true/false)
- `verification_state` (verified/unverified)
- `validators_run` (array of validator names)
- `validators_failed` (array of failed validator names)
- `failure_codes` (array of codes, if any)
- `canon_hash` / version

**Artifact Links:**
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (audit schema spec)
- Webpage Contract Matrix (Storygate rows, Audit Evidence column)
- BASE44_CONTRACT_ADDENDUM.md (Section 3.3: Audit Record mandatory)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] Structured audit event created for all state-changing actions
- [ ] All required fields populated
- [ ] Audit events queryable (not log-only)
- [ ] No free-text log substitution
- [ ] Evidence: query audit entity after test run shows complete records for all action types
- [ ] **Core behavior unchanged:** Audit is observational only

**Impact:** CRITICAL — blocks promotion to VERIFIED

---

### RG-STORYGATE-001-T4 — SLA Timing Metrics (Creation, Access, Verification)
**Priority:** P1 (High)  
**Type:** Governance Hardening

**Description:**

Current state: No timing capture in any Storygate function.

**Required:**

All Storygate functions must wrap major operations with timing:
- Capture `start_timestamp_ms` before operation
- Capture `end_timestamp_ms` after operation
- Calculate `elapsed_ms = end - start`
- Write to audit record's `sla_metrics` field

**Operations to time:**
- Listing creation
- Access request processing
- Access approval/denial
- Verification decision
- Access control checks

**Artifact Links:**
- `FUNCTION_INDEX.md` (Storygate → SLA Requirements)
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (sla_metrics field spec)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `sla_metrics` object in audit record for all Storygate actions
- [ ] `start_ms`, `end_ms`, `elapsed_ms` for overall request
- [ ] `operations` array with per-operation timing (where applicable)
- [ ] Evidence: audit record shows complete timing data for all action types
- [ ] **Core behavior unchanged:** Timing is observational only

**Impact:** HIGH — required for VERIFIED status

---

### RG-STORYGATE-001-T5 — Access Control Enforcement Proof (Security Gate)
**Priority:** P0 (Security Risk)  
**Type:** Critical Security

**Description:**

Current state: Access control logic exists but enforcement not provably auditable.

**Required:**

Prove access control cannot be bypassed:
- Private listings must not be discoverable without permission
- Request access without account must be blocked
- Request access to private listing must be blocked or show permission error
- All denied access attempts must be auditable

**Test scenarios (negative paths):**
- Unauthenticated user attempts access → 401 + audit event
- Industry user attempts access to private listing → 403 + audit event + validator failure
- Industry user attempts access without verification → 403 + audit event + validator failure

**Artifact Links:**
- `functions/checkProjectAccess.js` (access oracle)
- `functions/requestProjectAccess.js` (access request flow)
- STORYGATE_FLOW_MAP.md (access control rules)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] Private listings not discoverable in marketplace browse
- [ ] Direct access to private listing blocked (403 + user-visible error)
- [ ] Unauthenticated access blocked (401)
- [ ] Unverified industry access blocked (403)
- [ ] All denials logged with audit event + validator evidence
- [ ] Evidence: negative path tests show blocks + errors + audit + validators
- [ ] **Fail Rule:** Any bypass → FAILED (Security Risk)

**Impact:** CRITICAL — security gate, release-blocking if failed

---

### RG-STORYGATE-001-T6 — Verification State Enforcement (Admin-Controlled Trust Signal)
**Priority:** P0 (Security Risk)  
**Type:** Critical Security

**Description:**

Current state: Verification system functional, admin auth enforced, but state changes not in governance audit format.

**Required:**

Creator verification must be:
- Admin-controlled (only admin can set `verified: true`)
- Enforced server-side (not client-only badge)
- Auditable (structured audit event for all verification state changes)
- Validator-checked (verification state validator confirms admin auth + state persistence)

**Artifact Links:**
- `functions/handleVerification.js` (verification logic)
- `pages/AdminVerificationQueue.js` (admin UI)
- STORYGATE_STUDIO_DESIGN_SYSTEM.md (verification requirements)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] Admin sets `verified: true` and it persists server-side
- [ ] Verified badge visible on listing (reflects real state)
- [ ] Audit event created for verification state changes
- [ ] Validator confirms admin-only access (non-admin blocked)
- [ ] Verification state cannot be spoofed client-side
- [ ] Evidence: verification state change logged with audit event + validator evidence
- [ ] **Fail Rule:** Unverifiable trust signal → FAILED (Security Risk)

**Impact:** CRITICAL — trust signal integrity, release-blocking if failed

---

### RG-STORYGATE-001-T7 — Parameter & Actor Context Logging
**Priority:** P2 (Medium)  
**Type:** Governance Hardening

**Description:**

Current state: AccessLog entity includes basic context, but governance audit requires explicit actor fields.

**Required:**

Ensure actor context is captured in audit events:
- `creator_id` / `creator_email` (for listing creation, access approval)
- `requester_id` / `requester_email` (for access requests)
- `admin_id` / `admin_email` (for verification actions)
- `listing_id` (for all listing-related actions)
- `request_id` (correlates all steps of lifecycle)

**Artifact Links:**
- `EVALUATE_INCIDENT_LOG_SCHEMA.md` (audit schema)
- BASE44_CONTRACT_ADDENDUM.md (Section 3.3: actor context requirement)

**Acceptance Criteria (Definition of VERIFIED):**
- [ ] `creator_id` / `creator_email` populated for listing actions
- [ ] `requester_id` / `requester_email` populated for access requests
- [ ] `admin_id` / `admin_email` populated for verification actions
- [ ] `listing_id` present for all listing-related actions
- [ ] `request_id` correlates create → request → grant/deny flow
- [ ] Evidence: audit records show complete actor context
- [ ] **Core behavior unchanged:** Context logging is additive

**Impact:** MEDIUM — improves audit trail clarity

---

## Ticket Dependencies (Critical Path)

```
RG-STORYGATE-001-T8 (Dependency Check)
  ↓
RG-STORYGATE-001-T1 (Governed Entry)
  ↓
RG-STORYGATE-001-T2 (Validators) + RG-STORYGATE-001-T3 (Audit) [parallel]
  ↓
RG-STORYGATE-001-T4 (SLA) + RG-STORYGATE-001-T5 (Access Proof) + RG-STORYGATE-001-T6 (Verification Proof) [parallel]
  ↓
RG-STORYGATE-001-T7 (Context Logging)
```

**Critical Path:** T8 → T1 → T2/T3 → T4/T5/T6 → T7

---

## Incident Handling (Mandatory)

Any of the following must result in a governance incident ticket:

- Work begins without authorization
- Phase sequencing violated
- Access control bypassed
- Governance hooks bypassed
- Evidence missing at review time
- Validators skipped

**Incident Type:** GOVERNANCE_BYPASS

**Required Fields:**
- Epic ID
- Phase
- Files Touched
- Deployment Status
- Remediation Decision

**Work must pause until incident resolution.**

---

## Timeline Requirements (Non-Negotiable)

| Milestone | Deadline | Owner | Dependencies |
|-----------|----------|-------|--------------|
| Jira Acknowledgment + Phase-0 Confirmation | **2026-01-06 (Monday)** | Base44 DevOps | — |
| All 7 Tickets Created & Dependencies Configured | **2026-01-08 (Wednesday)** | Base44 DevOps | Phase-0 complete |
| Phase 1 Complete (Dependency Check: T8) | **2026-01-13 (Monday)** | Base44 Engineering | Confirms RG-EVAL-001 infrastructure |
| Phase 2 Complete (Validators: T2) | **2026-01-20 (Monday)** | Base44 Engineering | Phase 1 complete |
| Phase 3 Complete (Governed Entry + Audit: T1, T3) | **2026-02-03 (Monday)** | Base44 Engineering | Phase 2 complete |
| Phase 4 Complete (SLA + Security Proofs: T4, T5, T6, T7) | **2026-02-07 (Friday)** | Base44 Engineering | Phase 3 complete |
| Verification Walkthrough + Evidence Review | **2026-02-09 (Monday)** | RevisionGrade + Base44 | Phase 4 complete |
| Storygate → VERIFIED Status | **2026-02-10 (Tuesday)** | RevisionGrade | Evidence review passed |

**Release Gate:** Storygate must be VERIFIED by 2026-02-10 to unblock release. Any delay is release-blocking.

**Dates do not authorize work. Phase approval is required.**

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

## Final Instruction to Base44

**This Epic is governance-blocking and release-blocking.**

- Storygate functionality exists and behaves correctly.
- Governance enforcement layer (governed entry, validators, audit, SLA) is incomplete.
- This is not feature design — it is enforcement of already-accepted governance obligations.
- No code may be written, wired, or deployed until the Epic is acknowledged in Jira, Phase-0 confirmations are complete, and Phase authorization is explicitly granted.
- All acceptance decisions are evidence-based and human-authorized.
- Any deviation from this process triggers immediate incident logging and work stoppage.

---

## Success Criteria

This Epic is complete when:

1. All 7 tickets marked DONE with evidence links
2. FUNCTION TEST #6 re-run shows VERIFIED status
3. **All access control + verification enforcement proven** (no bypasses)
4. **All state changes auditable** (structured events, not logs)
5. **All validators execute** (outcomes recorded)
6. Storygate rows in Webpage Contract Matrix updated to VERIFIED
7. No open governance incidents related to this Epic

**Until then, Storygate remains PARTIALLY VERIFIED and release-blocked.**

---

## Security Escalation

**Access control and verification are trust signals.**

If either can be bypassed or spoofed:
- Storygate = **FAILED (Security Risk)**
- Release-blocking until remediated
- Incident severity: CRITICAL

**No workarounds. No exceptions.**