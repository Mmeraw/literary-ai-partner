# PHASE 3 EXECUTION RULES v1.0.0

**Authority:** StoryGate Studio Implementation Roadmap  
**Status:** LOCKED  
**Last Modified:** 2026-01-08

## Purpose

Governs the strict execution protocol for implementing Phase 3 (Industry Professional Verification) functions with zero scope drift.

## Core Principle

**Every function must be:**
1. Defined atomically (one state transition, one responsibility)
2. Tested with release-blocking assertions
3. Locked before proceeding to the next function

## Execution Protocol

### Step 1: Define Function Scope (Atomic)

Each function must specify:
- **State Transition:** Exactly ONE state machine edge (e.g., UNVERIFIED→PENDING)
- **Role Gate:** Who can invoke (e.g., agents only, admin only)
- **DTO Allowlist:** What fields are returned to non-admin users
- **Error Shape:** Canonical safe error format

### Step 2: Write Canon Documentation

Before writing code, create canon files defining:
- Entity schema (state machine, validation rules)
- Function specification (inputs, outputs, invariants)
- Security rules (DTO allowlists, role gates)

**EXCEPTION LOG (Jan 8, 2026):**  
`functions/_canon/` directory did not exist in repository. Canon docs were created in `functions/_canon/` on Jan 8, 2026. Previous copies under `functions/canon/` (no underscore) were retired.

### Step 3: Implement Function

Write backend function adhering strictly to canon spec:
- Enforce state machine transitions
- Apply DTO allowlist for author-facing responses
- Return safe error shape: `{ code, message, requestId }` ONLY
- No `success` field in errors (breaks invariant)

### Step 4: Write Release-Blocking Tests

Each function must have 4 tests:
1. **Role Gate:** Verify access control (e.g., authors blocked)
2. **State Machine:** Verify valid/invalid transitions
3. **DTO Allowlist:** Verify no PII leakage
4. **Safe Error Shape:** Verify error format compliance

### Step 5: Run Tests & Lock

- Run test suite
- Verify all 4 tests pass
- Document test results
- Lock function (no further changes without CCR)

### Step 6: Proceed to Next Function

Only after lock, move to next atomic function.

## Change Control

Any modification to this spec requires:
1. Updated semantic version (v1.1.0, v2.0.0, etc.)
2. CCR (Canon Change Request) with rationale
3. Security review for state machine/role gate changes