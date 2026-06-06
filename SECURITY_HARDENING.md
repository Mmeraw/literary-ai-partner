# Security Hardening Sprint #1 — revisiongrade.com

## Scope

This sprint hardens access control and abuse defenses without changing product behavior, except to block unauthorized or abusive requests.

## Threat model

### Primary risks addressed

- Unauthorized access to other users' jobs, manuscripts, reports, and downloads.
- Public API abuse (credential stuffing, upload spam, eval flood, report scraping).
- Worker endpoint triggering by untrusted callers.
- Browser-side attack surface (clickjacking, MIME confusion, weak referrer controls).
- Internal pipeline details leaking to non-admin users.

### Out of scope (deferred)

- Full malware/AV scanning service for uploaded files.
- Redis-backed distributed rate limiting (current limiter is process-local memory).
- Full RLS policy audit migration pack (requires schema migration review + SQL policy snapshots).

## Route protection matrix

| Route class | Required guard | Additional controls |
|---|---|---|
| `/api/admin/*` | Admin session (`requireAdmin`) | no-store responses where applicable |
| `/api/workers/*` | `x-worker-secret` + existing worker auth path | worker-specific rate limit |
| User APIs (default `/api/*`) | authenticated user session unless explicit public allowlist | endpoint-level rate limits |
| Public webhooks (`/api/stripe/webhook`) | webhook signature verification (route-specific) | excluded from session auth requirement |
| Public utility (`/api/health`, `/api/contact`, `/api/analytics/track`, `/api/auth/callback`) | explicit allowlist | global security headers |

## Implemented controls

1. **Global security headers in middleware**
   - `Content-Security-Policy`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy`
   - `Strict-Transport-Security` (production only)

2. **Default API auth lock-down**
   - Middleware now treats `/api` as protected by default.
   - Explicit public API allowlist is required for unauthenticated access.

3. **Worker secret enforcement**
   - `/api/workers/*` requires `x-worker-secret` (except CI/test bypass path).
   - Route-level enforcement added to `process-evaluations` as defense-in-depth.

4. **Endpoint rate limits**
   - Manuscript upload (`/api/manuscripts` POST)
   - Evaluation submission (`/api/evaluate` POST)
   - Report downloads (`/api/reports/[jobId]/download` GET)
   - Worker execution trigger (`/api/workers/process-evaluations` GET)

5. **Upload hardening**
   - Extension allowlist (`.txt`, `.docx`)
   - MIME allowlist (strict known set)
   - Dangerous extension rejection
   - Filename sanitization before downstream use
   - Size/word-count ceilings remain enforced

6. **Safer non-admin error exposure**
   - Removed internal database details from user-facing upload failures.
   - Evaluation submit now returns stable error code envelope in production.

## Manual production checklist

- [ ] Set `WORKER_SECRET` in production and cron worker caller.
- [ ] Verify public API allowlist exactly matches intended public surface.
- [ ] Confirm `CRON_SECRET` and `WORKER_SECRET` are rotated and stored only in secret managers.
- [ ] Ensure `SUPABASE_SERVICE_ROLE_KEY` is never present in client bundle and never logged.
- [ ] Validate Supabase RLS policies enforce `user_id = auth.uid()` for user-owned tables.
- [ ] Run smoke tests for:
  - [ ] authenticated manuscript upload/evaluate flow
  - [ ] unauthenticated API rejection on protected routes
  - [ ] worker invocation with and without `x-worker-secret`
  - [ ] cross-user report/job access returns 404/forbidden-safe response

## Security notes

- Rate limiting is intentionally fail-open in test mode and process-local in runtime; migrate to shared-store (Redis/Upstash) before major horizontal scale.
- `WORKER_SECRET` is an additional layer and does not replace existing cron/service auth checks.
- Keep this document updated when public endpoints or auth contracts change.
