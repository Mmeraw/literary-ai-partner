# Agent Onboarding Verification Specification v1.0.0

**Authority:** Phase 3 canonical specification for industry professional verification
**Scope:** Function #1 (createAgentVerificationRequest)
**Lifecycle:** UNVERIFIED → PENDING (agent-initiated, self-service only)

## State Machine

### Allowed Transitions
- **UNVERIFIED → PENDING**: Agent submits verification request (self-service)
  - First-time submission OR update from UNVERIFIED state
  - Idempotent: if already PENDING, returns existing record

### Blocked Transitions (State Violations)
- **VERIFIED → PENDING**: Cannot request re-verification
- **REJECTED → PENDING**: Cannot resubmit after rejection
- **REVOKED → PENDING**: Cannot restore revoked status
- **PENDING → PENDING**: Idempotent return (not an error)

## Role Gate (Security Invariant)

### Denied Roles (403 Forbidden)
- `author`: Authors cannot request industry verification
- `user`: Regular users cannot request industry verification
- Unauthenticated users: 401 Unauthorized

### Allowed Roles
- `agent`, `producer`, `executive`, `manager`: Can request verification

## Allowlist DTO Rule

See: `AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md`

Only these fields returned to non-admin users:
- id
- full_name
- company
- role_type
- verification_status
- bio

**Banned fields** (never returned to non-admin):
- user_email
- verification_date
- verified_by
- rate_limit_flags
- suspended
- linkedin_url (admin verification only)
- imdb_url (admin verification only)

## Error Shape (Canonical)

All errors must return exactly this shape:
```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "requestId": "req_timestamp_random"
}
```

**No stack traces, no internal IDs, no database errors exposed.**

## Validation Rules

### Required Fields
- full_name (non-empty string)
- company (non-empty string)
- role_type (must be in allowlist)

### Role Type Allowlist
- `agent`
- `producer`
- `executive`
- `manager`

### Optional Fields
- bio
- linkedin_url (for admin verification)
- imdb_url (for admin verification)

## Function Boundary (What This Does NOT Do)

- ❌ Does not approve/reject verification (admin-only, separate function)
- ❌ Does not create organizations
- ❌ Does not assign roles
- ❌ Does not grant portal access
- ❌ Does not send invitations
- ❌ Does not transition to VERIFIED/REJECTED/REVOKED

## Governance Version

`AGENT_ONBOARDING_VERIFICATION_SPEC_v1.0.0`

## Release-Blocking Tests

See: `functions/tests/createAgentVerificationRequest.test.js`

1. **AUTHOR denied (403)**: Author/user roles cannot request verification
2. **State machine**: Only UNVERIFIED → PENDING succeeds
3. **Allowlist DTO**: Banned fields never returned
4. **Error shape**: Exactly {code, message, requestId}