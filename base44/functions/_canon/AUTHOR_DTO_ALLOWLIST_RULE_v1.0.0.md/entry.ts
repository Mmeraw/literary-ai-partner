# Author DTO Allowlist Rule v1.0.0

**Authority:** Security invariant for data exposure to non-admin users
**Scope:** All functions returning IndustryUser data to authors/public

## Security Principle

Authors and non-admin users must NEVER receive sensitive fields from IndustryUser records. This prevents:
- Email harvesting
- Verification gaming (seeing who verified/when)
- Abuse detection evasion (rate limits, suspension status)
- Privacy violations (personal verification URLs)

## Allowlist (toAuthorDTO)

Only these fields may be returned to non-admin users:

```typescript
{
  id: string,
  full_name: string,
  company: string,
  role_type: string,
  verification_status: string,
  bio: string
}
```

## Banned Fields (Never Return to Non-Admin)

- ❌ `user_email`: Enables harassment/spam
- ❌ `verification_date`: Reveals verification timeline
- ❌ `verified_by`: Exposes admin identities
- ❌ `linkedin_url`: Personal verification data
- ❌ `imdb_url`: Personal verification data
- ❌ `rate_limit_flags`: Security telemetry
- ❌ `suspended`: Security status

## Implementation Pattern

```javascript
function toAuthorDTO(industryUser) {
    return {
        id: industryUser.id,
        full_name: industryUser.full_name,
        company: industryUser.company,
        role_type: industryUser.role_type,
        verification_status: industryUser.verification_status,
        bio: industryUser.bio
    };
}
```

## Enforcement

### Where This Rule Applies
- `createAgentVerificationRequest`: Returns toAuthorDTO after submission
- `getAgentVerificationStatus`: Returns toAuthorDTO for status check
- Any future function returning IndustryUser to non-admin users

### Where This Rule Does NOT Apply
- Admin verification functions (admin can see all fields)
- Internal service-to-service calls
- Audit logs (privileged access)

## Test Coverage

Required test: "Allowlist DTO / banned fields absent"
- Call function as non-admin user
- Verify response contains ONLY allowlist fields
- Verify response does NOT contain any banned fields
- Check both success and error cases

## Governance Version

`AUTHOR_DTO_ALLOWLIST_RULE_v1.0.0`

## Exception Log

**No exceptions granted as of 2026-01-08.**

If a future function requires exposing additional fields:
1. Document security justification
2. Add to exception log with date + approver
3. Update test coverage
4. Increment rule version