# Security Invariants Index v1.0.0

## Safe Error Shape
All Phase 3 functions MUST return errors in this exact shape:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "requestId": "req_1234567890_abcdef"
}
```

### Forbidden Fields in Error Responses
- ❌ `success` - Redundant with HTTP status
- ❌ `stack` - Exposes internal implementation
- ❌ `details` - May leak sensitive data
- ❌ Any database IDs or internal references

### Implementation
```javascript
function errorResponse(code, message, requestId, status = 400) {
    return Response.json({
        code,
        message,
        requestId
    }, { status });
}
```

## Request ID Format
- Pattern: `req_{timestamp}_{random}`
- Example: `req_1736352000_7a9k3m`
- Purpose: Traceable across logs without exposing internal IDs

## Role Gate Pattern
```javascript
// CORRECT: Block authors from industry functions
if (user.role === 'author' || user.role === 'user') {
    return errorResponse('ROLE_FORBIDDEN', 'Authors cannot access this resource', requestId, 403);
}

// INCORRECT: Allow-list only (misses future roles)
if (user.role !== 'agent') {
    return errorResponse('FORBIDDEN', 'Access denied', requestId, 403);
}
```

## DTO Filtering Enforcement
ALL responses containing IndustryUser data MUST use `toAuthorDTO()` unless user is admin.

## State Machine Enforcement
ALL state transitions MUST be validated against AGENT_ONBOARDING_VERIFICATION_SPEC before updating database.