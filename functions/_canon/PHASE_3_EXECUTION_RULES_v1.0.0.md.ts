# PHASE_3_EXECUTION_RULES_v1.0.0.md

**Canon Rules — Phase 3 Execution Hygiene (v1.0.0)**

**Status:** CANON-READY  
**Change Control:** CCR required after freeze  
**Last-Modified:** 2026-01-08  
**Depends on:** SECURITY_INVARIANTS_INDEX_v1.0.0.md (v1.0.0), AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md (v1.0.0)

---

## Purpose

Prevent drift, leakage, and revert loops during Phase 3 implementation by enforcing strict one-at-a-time execution with mandatory test gates.

---

## Non-Negotiable Rules

### Rule 1: One Function Per PR

Each backend function must be implemented in a separate pull request.

**No bulk creation of multiple functions/endpoints in a single PR.**

### Rule 2: Tests Required in Same PR

Every function PR must include all release-blocking tests defined in its Definition of Done:
- Role gate tests
- State machine tests (if applicable)
- Allowlist serialization tests
- Safe error shape tests
- Audit emission tests (if applicable)

**No "we'll add tests later" allowed.**

### Rule 3: Stop + Summarize

After each function is implemented, the implementer must provide a summary including:
- Filename and route
- Input payload shape
- Output DTO shape
- Canon sections implemented (by spec + section number)
- Tests added (by name)

**No work on the next function may begin until explicit approval is given.**

### Rule 4: No Shared Endpoints Without Role Shaping

No endpoint may be callable by both AUTHOR and INDUSTRY roles unless:
- Server-side role-shaped DTO selection is implemented before serialization
- Tests verify correct DTO selection per role
- Both Author and Industry DTO paths are explicitly tested

**UI-based role checks are not sufficient.**

### Rule 5: No Bulk Creation

Do not create multiple entities, functions, or endpoints simultaneously "to save time."

**Atomic, sequential implementation is required for audit trail and revert safety.**

---

## Function Implementation Order (Phase 3)

Functions must be implemented in this exact order:

### Phase 3A - Onboarding & Verification
1. `createAgentVerificationRequest` (UNVERIFIED → PENDING)
2. `getAgentVerificationStatus` (read-only)
3. `approveAgentVerification` (PENDING → VERIFIED, admin-only)
4. `rejectAgentVerification` (PENDING → REJECTED, admin-only)
5. `suspendIndustryUser` (VERIFIED → SUSPENDED, admin-only)

### Phase 3B - Submissions & Decisions
6. `getIndustrySubmissionsList` (read-only, pagination required)
7. `recordIndustryDecision` (append-only)
8. `getSubmissionDecisions` (read-only)

### Phase 3C - Templates & Messaging
9. `getResponseTemplates` (read-only, resolution order)
10. `sendIndustryMessage` (highest trust surface, last)

**No function may be started until the previous function is approved and locked.**

---

## Path Conventions

All canon specifications must be written to:
- `functions/_canon/` (underscore, no spaces)

Not:
- `functions/canon/`
- `functions/ canon/`
- filenames with spaces

**Consistent paths prevent "can't find spec" failures.**

---

## Release Gates

Any PR that fails its required tests must be rejected until fixed.

No merge exceptions for:
- Missing tests
- Failing role gate tests
- Author DTO leakage
- Unsafe error shapes

**These are security and trust invariants, not suggestions.**