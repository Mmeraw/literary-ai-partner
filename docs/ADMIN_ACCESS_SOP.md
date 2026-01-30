# Admin Access Standard Operating Procedure (SOP)

**Document Version:** 1.0  
**Last Updated:** 2026-01-30  
**Owner:** RevisionGrade Operations

---

## Overview

Admin endpoints require authentication via `x-admin-key` header. This document describes how to access admin surfaces, rotate keys, and troubleshoot access issues.

---

## Admin Endpoints

All endpoints under `/api/admin/*` require authentication:

- `GET /api/admin/diagnostics` — System metrics dashboard
- `GET /api/admin/dead-letter` — Failed jobs queue
- `POST /api/admin/jobs/[jobId]/retry` — Manual job retry

---

## Authentication

### Header Format
```http
x-admin-key: <64-character-hex-string>
```

### Key Location

**Development:**
- Key is stored in `.env.local`
- File: `/workspaces/literary-ai-partner/.env.local`
- Variable: `ADMIN_API_KEY=<key>`

**Production (Vercel):**
- Set in Vercel Dashboard → Project Settings → Environment Variables
- Variable: `ADMIN_API_KEY`
- Scope: Production, Preview, Development

**Security Notes:**
- ⚠️ **Never commit `.env.local` to git** (already in `.gitignore`)
- ⚠️ **Never expose `ADMIN_API_KEY` to client code**
- ⚠️ **Never log the full key value**

---

## Usage Examples

### ✅ Successful Request
```bash
# Export key from environment
export ADMIN_API_KEY=$(grep ADMIN_API_KEY .env.local | cut -d '=' -f2)

# Call diagnostics endpoint
curl -H "x-admin-key: $ADMIN_API_KEY" \
  http://localhost:3002/api/admin/diagnostics | jq '.success'

# Expected: true
```

### ❌ Unauthorized Request
```bash
# No header
curl -i http://localhost:3002/api/admin/diagnostics

# Expected: 401 Unauthorized
# Body: {"success":false,"error":{"code":"admin_unauthorized",...}}
```

### Rate Limited Request (Retry Endpoint)
```bash
# After 5 retries in 1 minute
curl -H "x-admin-key: $ADMIN_API_KEY" \
  -X POST http://localhost:3002/api/admin/jobs/some-job-id/retry

# Expected (if rate limited): 429 Too Many Requests
# Body: {"ok":false,"error":"Too many retry requests","retryAfter":60}
```

---

## Key Rotation

### When to Rotate
- **Immediate:** Key has been leaked/exposed
- **Routine:** Every 90 days (recommended)
- **Onboarding:** When team member with access leaves

### Rotation Procedure

**1. Generate New Key**
```bash
cd /workspaces/literary-ai-partner
NEW_KEY=$(openssl rand -hex 32)
echo "New key: $NEW_KEY"
```

**2. Update Local Environment**
```bash
# Backup old key (just in case)
grep ADMIN_API_KEY .env.local >> .env.local.backup

# Replace in .env.local
sed -i "s/ADMIN_API_KEY=.*/ADMIN_API_KEY=$NEW_KEY/" .env.local

# Verify
grep ADMIN_API_KEY .env.local
```

**3. Update Production (Vercel)**
- Go to Vercel Dashboard
- Project Settings → Environment Variables
- Find `ADMIN_API_KEY`
- Click "Edit" → Update value → Save
- Redeploy (or it auto-deploys on save)

**4. Test New Key**
```bash
export ADMIN_API_KEY=$(grep ADMIN_API_KEY .env.local | cut -d '=' -f2)
curl -H "x-admin-key: $ADMIN_API_KEY" http://localhost:3002/api/admin/diagnostics
```

**5. Invalidate Old Key**
- Old key becomes invalid immediately after Vercel redeploy
- Anyone using old key gets 401

---

## Rate Limits

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| `POST /api/admin/jobs/[jobId]/retry` | 5 requests | 60 seconds | Per IP |

**Rate Limit Headers:**
- Status: `429 Too Many Requests`
- Body: `{ "retryAfter": 60 }` (seconds to wait)

**Bypass:** Rate limits are per-IP. Use different IP or wait for window to reset.

---

## Troubleshooting

### 401 Unauthorized

**Symptom:**
```json
{
  "success": false,
  "error": {
    "code": "admin_unauthorized",
    "message": "Unauthorized - admin access required"
  }
}
```

**Causes:**
1. Missing `x-admin-key` header
2. Wrong key value
3. Key not set in environment

**Fix:**
```bash
# Check key is set
grep ADMIN_API_KEY .env.local

# Export and test
export ADMIN_API_KEY=$(grep ADMIN_API_KEY .env.local | cut -d '=' -f2)
curl -H "x-admin-key: $ADMIN_API_KEY" http://localhost:3002/api/admin/diagnostics
```

### 500 Admin Config Missing

**Symptom:**
```json
{
  "success": false,
  "error": {
    "code": "admin_config_missing",
    "message": "Admin API key not configured"
  }
}
```

**Cause:** `ADMIN_API_KEY` not set in server environment

**Fix:**
```bash
# Development
echo "ADMIN_API_KEY=$(openssl rand -hex 32)" >> .env.local
npm run dev

# Production (Vercel)
# Add ADMIN_API_KEY in Vercel Dashboard → Environment Variables
```

### 429 Rate Limited

**Symptom:**
```json
{
  "ok": false,
  "error": "Too many retry requests",
  "retryAfter": 60
}
```

**Cause:** Exceeded rate limit (5 requests/minute)

**Fix:** Wait 60 seconds before retrying

---

## Emergency Access

### Lost ADMIN_API_KEY

**Development:**
1. Generate new key: `openssl rand -hex 32`
2. Update `.env.local`
3. Restart server

**Production:**
1. Generate new key
2. Update in Vercel Dashboard
3. Redeploy

**Note:** Old key becomes invalid immediately.

### Need Emergency Bypass

**Not recommended.** If you absolutely must:
1. Temporarily comment out `requireAdmin()` check in route
2. Deploy
3. Perform admin action
4. Immediately re-enable auth
5. Redeploy

Better: Generate new key and update environment.

---

## Audit Trail

All admin actions are logged:

**Location:** `public.admin_actions` table (Supabase)

**Fields:**
- `action_type` — e.g., "manual_retry"
- `job_id` — Affected job
- `performed_by` — "admin-api" (or user ID if JWT auth added)
- `performed_at` — Timestamp
- `before_state` — Job state before action
- `after_state` — Job state after action

**Query:**
```sql
SELECT * FROM public.admin_actions 
ORDER BY performed_at DESC 
LIMIT 20;
```

---

## Security Best Practices

1. ✅ **Rotate keys regularly** (every 90 days minimum)
2. ✅ **Use HTTPS only** in production
3. ✅ **Log all admin actions** (already implemented)
4. ✅ **Monitor for unauthorized attempts** (check logs for `admin_unauthorized` events)
5. ✅ **Keep `.env.local` out of git** (already in `.gitignore`)
6. ❌ **Never expose key in client code** (only server-side)
7. ❌ **Never commit keys to repository**
8. ❌ **Never share keys via insecure channels** (Slack, email, etc.)

---

## Future Enhancements

Planned improvements (not yet implemented):

- **JWT-based auth:** Replace `x-admin-key` with Supabase JWT roles
- **Per-user keys:** Individual keys for audit attribution
- **Key expiration:** Auto-expire keys after N days
- **IP allowlisting:** Restrict admin access to known IPs
- **2FA requirement:** Additional auth factor for sensitive operations

---

## Support

**Questions?** Contact operations team or see:
- [PHASE_A5_DAY1_COMPLETE.md](PHASE_A5_DAY1_COMPLETE.md)
- [PHASE_A5_72HR_PLAN.md](PHASE_A5_72HR_PLAN.md)

**Emergency?** Follow emergency access procedure above.

---

**End of SOP**
