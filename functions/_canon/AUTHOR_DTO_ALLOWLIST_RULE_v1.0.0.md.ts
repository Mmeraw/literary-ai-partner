# AUTHOR DTO ALLOWLIST RULE v1.0.0

**Authority:** Phase 3 Execution Rules v1.0.0  
**Status:** LOCKED  
**Last Modified:** 2026-01-08

## Purpose

Prevents sensitive author data from leaking to industry professionals during verification and access flows.

## The Rule

**When returning IndustryUser data to non-admin users, ONLY return fields via `toAuthorDTO()`.**

### Allowed Fields (Public to Authors)

```typescript
function toAuthorDTO(industryUser: IndustryUser) {
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

### Forbidden Fields (Admin-Only)

- `user_email` (PII, abuse risk)
- `linkedin_url` (verification evidence, not public-facing)
- `imdb_url` (verification evidence, not public-facing)
- `verified_by` (internal process data)
- `verification_date` (internal process data)
- `rate_limit_flags` (abuse detection, not public)
- `suspended` (abuse detection, not public)

## Rationale

**Threat Model:**
- Authors must see which industry professionals are accessing their work
- Industry professionals must not harvest author emails from public endpoints
- LinkedIn/IMDb links are for admin verification only, not public profiles

## Implementation

### ✅ CORRECT (Phase 3 Compliant)

```javascript
// Backend function returning to author
const industryUsers = await base44.entities.IndustryUser.filter({ 
  verification_status: 'VERIFIED' 
});

return Response.json({
  success: true,
  agents: industryUsers.map(toAuthorDTO) // <-- ALLOWLIST APPLIED
});
```

### ❌ FORBIDDEN (Leaks PII)

```javascript
// Backend function returning to author
const industryUsers = await base44.entities.IndustryUser.filter({ 
  verification_status: 'VERIFIED' 
});

return Response.json({
  success: true,
  agents: industryUsers // <-- FULL RECORD, LEAKS EMAIL/URLS
});
```

## Testing

**Release-Blocking Test:** Verify that non-admin API responses do NOT contain forbidden fields.

```javascript
// Test: Call endpoint as author, assert no email leakage
const response = await fetch('/api/listVerifiedAgents', {
  headers: { 'Authorization': `Bearer ${authorToken}` }
});
const data = await response.json();

assert(data.agents.every(agent => !agent.user_email));
assert(data.agents.every(agent => !agent.linkedin_url));
```

## Change Control

Any modification to allowed/forbidden fields requires:
1. Semantic version bump
2. Security review
3. Regression test update