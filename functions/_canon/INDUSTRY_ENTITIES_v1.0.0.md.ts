# INDUSTRY ENTITIES SPECIFICATION v1.0.0

**Authority:** Phase 3 Execution Rules v1.0.0  
**Status:** LOCKED  
**Last Modified:** 2026-01-08

## Purpose

Defines the canonical entities for industry professional management (agents, producers, executives) within the StoryGate Studio system.

## Entity: IndustryUser

**Primary Purpose:** Track verified industry professionals who access author work.

### Schema

```json
{
  "name": "IndustryUser",
  "type": "object",
  "properties": {
    "user_email": {
      "type": "string",
      "description": "Email of the verified industry professional"
    },
    "full_name": {
      "type": "string",
      "description": "Full name"
    },
    "company": {
      "type": "string",
      "description": "Company/agency name"
    },
    "role_type": {
      "type": "string",
      "enum": ["agent", "producer", "executive", "manager", "other"],
      "description": "Type of industry professional"
    },
    "verification_status": {
      "type": "string",
      "enum": ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "REVOKED"],
      "default": "UNVERIFIED",
      "description": "Verification state (state machine enforced)"
    },
    "verification_date": {
      "type": "string",
      "format": "date-time",
      "description": "When verification was completed"
    },
    "bio": {
      "type": "string",
      "description": "Professional bio"
    },
    "linkedin_url": {
      "type": "string",
      "description": "LinkedIn profile for verification"
    },
    "imdb_url": {
      "type": "string",
      "description": "IMDb profile for verification"
    },
    "verified_by": {
      "type": "string",
      "description": "Admin who verified this user"
    },
    "rate_limit_flags": {
      "type": "number",
      "default": 0,
      "description": "Number of rate limit violations"
    },
    "suspended": {
      "type": "boolean",
      "default": false,
      "description": "Account suspended for abuse"
    }
  },
  "required": ["user_email", "full_name", "company", "role_type"]
}
```

## State Machine: verification_status

**CRITICAL:** State transitions are strictly enforced by backend functions. UI cannot bypass.

### Valid Transitions

```
UNVERIFIED → PENDING (via createAgentVerificationRequest, agent-initiated)
PENDING → VERIFIED (via approveAgent, admin-only)
PENDING → REJECTED (via rejectAgent, admin-only)
VERIFIED → REVOKED (via revokeAgent, admin-only)
```

### Forbidden Transitions

- UNVERIFIED → VERIFIED (bypass protection)
- PENDING → UNVERIFIED (rollback protection)
- REJECTED → VERIFIED (must create new record)
- Any transition not explicitly listed above

## Security Invariants

1. **Role Gate:** Only `role_type IN ['agent', 'producer', 'executive', 'manager']` can request verification
2. **Single Request:** An agent can only have ONE active PENDING request at a time
3. **No Self-Verification:** Admin cannot verify their own IndustryUser record
4. **Audit Trail:** All state changes logged to `IndustryDecision` entity

## Related Entities

- **IndustryDecision:** Audit log for verification decisions
- **AccessUnlock:** Tracks which projects an industry user has accessed
- **IndustryMessage:** Communication between authors and verified industry users

## Change Control

Any modification to this spec requires:
1. Updated semantic version (v1.1.0, v2.0.0, etc.)
2. Migration plan for existing IndustryUser records
3. Regression test suite update