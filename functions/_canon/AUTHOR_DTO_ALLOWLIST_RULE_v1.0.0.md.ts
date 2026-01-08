# Author DTO Allowlist Rule v1.0.0

## Purpose
Prevents sensitive data leakage when industry user records are returned to non-admin users.

## Allowlist Fields
The following fields MAY be returned to authors and non-admin users:

```json
{
  "id": "string",
  "full_name": "string",
  "company": "string",
  "role_type": "string",
  "verification_status": "string",
  "bio": "string"
}
```

## Forbidden Fields
The following fields MUST NOT be returned to non-admin users:
- `user_email` - Prevents contact info leakage
- `linkedin_url` - Prevents direct contact
- `imdb_url` - Prevents direct contact
- `verified_by` - Internal admin info
- `verification_date` - Internal admin info
- `rate_limit_flags` - Internal security info
- `suspended` - Internal security info

## Implementation
All Phase 3 functions MUST use the `toAuthorDTO()` transform function:

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

## Admin Exception
Admin users (role='admin') MAY receive full IndustryUser records without filtering.

## Enforcement
- **Backend:** All functions returning IndustryUser data MUST apply toAuthorDTO filter
- **Frontend:** UI components MUST NOT assume access to filtered fields
- **Tests:** Release-blocking test MUST verify DTO compliance