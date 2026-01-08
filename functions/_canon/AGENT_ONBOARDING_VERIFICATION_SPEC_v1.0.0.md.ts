# Agent Onboarding Verification Specification v1.0.0

## Authority
This document is the canonical specification for industry professional verification within the Storygate system.

## State Machine

### Valid States
- `UNVERIFIED` - Initial state, no verification requested
- `PENDING` - Verification request submitted, awaiting admin review
- `VERIFIED` - Admin-approved industry professional
- `REJECTED` - Verification request denied
- `REVOKED` - Previously verified, access revoked

### Valid Transitions
- `UNVERIFIED` → `PENDING` (agent-initiated, self-service)
- `PENDING` → `VERIFIED` (admin approval)
- `PENDING` → `REJECTED` (admin denial)
- `VERIFIED` → `REVOKED` (admin revocation)

### Forbidden Transitions
- `VERIFIED` → `PENDING` (cannot re-request after verification)
- `REJECTED` → `PENDING` (cannot re-request after rejection)
- `REVOKED` → `PENDING` (cannot re-request after revocation)

## Role Gates

### Function: createAgentVerificationRequest
- **Allowed:** Users with role NOT equal to 'author' or 'user'
- **Blocked:** Authors (role='author' or role='user') → 403 Forbidden

### Function: getAgentVerificationStatus
- **Allowed:** All authenticated users (read-only)
- **Blocked:** Unauthenticated requests → 401 Unauthorized

## Data Access Rules
Refer to `AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0.md` for field-level access control.

## Security Invariants
1. **No stack traces** in error responses (use safe error shape)
2. **No internal IDs** exposed (use requestId for tracing)
3. **DTO filtering** enforced on all non-admin responses
4. **State machine** strictly enforced (no manual status overrides)

## Release-Blocking Tests
All Phase 3 functions must pass:
1. Role gate enforcement
2. State machine validation
3. DTO allowlist compliance
4. Safe error shape verification