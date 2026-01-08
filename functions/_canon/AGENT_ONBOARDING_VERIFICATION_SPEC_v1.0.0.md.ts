# AGENT ONBOARDING & VERIFICATION SPECIFICATION v1.0.0

**Authority:** Phase 3 Execution Rules v1.0.0  
**Status:** LOCKED  
**Last Modified:** 2026-01-08

## Purpose

Defines the canonical verification flow for industry professionals (agents, producers, executives) requesting access to StoryGate Studio author work.

## Verification Flow

### Phase 1: Agent Self-Registration (UNVERIFIED → PENDING)

**Function:** `createAgentVerificationRequest`

**Who:** Industry professional (self-service)

**Input:**
```json
{
  "full_name": "Jane Smith",
  "company": "Big Agency LLC",
  "role_type": "agent",
  "bio": "15 years repping literary fiction...",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "imdb_url": "https://imdb.com/name/nm1234567" // optional
}
```

**State Transition:** `UNVERIFIED → PENDING`

**Validations:**
1. User must be authenticated
2. User role must NOT be 'author' (agents cannot be authors)
3. `role_type` must be one of: `['agent', 'producer', 'executive', 'manager']`
4. No existing PENDING request for this user
5. All required fields present

**Output (Success):**
```json
{
  "success": true,
  "request": {
    "id": "industry_user_abc123",
    "verification_status": "PENDING",
    "submitted_at": "2026-01-08T10:00:00Z"
  }
}
```

**Output (Error - Safe Shape):**
```json
{
  "success": false,
  "code": "ROLE_FORBIDDEN",
  "message": "Authors cannot request industry verification",
  "requestId": "req_xyz789"
}
```

### Phase 2: Admin Review (PENDING → VERIFIED or REJECTED)

**Function:** `approveAgent` or `rejectAgent`

**Who:** Admin only

**Not Implemented Yet:** Phase 3 Function #2 (future work)

### Phase 3: Revocation (VERIFIED → REVOKED)

**Function:** `revokeAgent`

**Who:** Admin only

**Not Implemented Yet:** Phase 3 Function #3 (future work)

## State Machine Enforcement

**CRITICAL:** Backend functions are the ONLY way to transition `verification_status`.

### Function #1: createAgentVerificationRequest

- **Allowed:** `UNVERIFIED → PENDING`
- **Forbidden:** Any other transition
- **Role Gate:** Authors blocked (403)
- **Idempotency:** If already PENDING, return existing record (not error)

### Function #2: approveAgent (Future)

- **Allowed:** `PENDING → VERIFIED`
- **Forbidden:** Direct `UNVERIFIED → VERIFIED` (bypass protection)
- **Role Gate:** Admin only

### Function #3: rejectAgent (Future)

- **Allowed:** `PENDING → REJECTED`
- **Admin Note:** Required reason for rejection

### Function #4: revokeAgent (Future)

- **Allowed:** `VERIFIED → REVOKED`
- **Admin Note:** Required reason for revocation
- **Cascade:** Revoke all AccessUnlock records

## Security Invariants

1. **No Bypass:** UI cannot directly update `verification_status` field
2. **Role Separation:** Authors cannot verify themselves as agents
3. **Audit Trail:** All transitions logged to `IndustryDecision` entity
4. **PII Protection:** See AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md

## Error Handling Standard

All functions return safe error shapes (no stack traces, no internal IDs):

```json
{
  "success": false,
  "code": "VALIDATION_FAILED" | "ROLE_FORBIDDEN" | "STATE_VIOLATION",
  "message": "Human-readable error",
  "requestId": "req_abc123" // for support lookup
}
```

## Testing Requirements

**Release-Blocking Tests (Function #1):**

1. **Role Gate:** Author calling `createAgentVerificationRequest` returns 403
2. **State Machine:** UNVERIFIED→PENDING succeeds, PENDING→PENDING is idempotent, VERIFIED→PENDING fails
3. **DTO Allowlist:** Response includes only allowed fields (no email leakage)
4. **Error Shape:** All errors return `{ success, code, message, requestId }`

## Change Control

Any modification to this flow requires:
1. Updated semantic version (v1.1.0, v2.0.0, etc.)
2. Regression test suite update
3. Security review for PII/bypass risks