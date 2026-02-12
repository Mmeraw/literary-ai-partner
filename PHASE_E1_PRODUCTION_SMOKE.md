# Phase E1 – Production Smoke Test

Goal: Prove that the literary-ai-partner system works end-to-end on Vercel + Supabase production for a real evaluation job.

## 1. Environment

- Production URL: `https://literary-ai-partner.vercel.app/`
- Backend data store: Supabase (production project: `<name or id>`)
- Deployed from branch: `main`
- Deployed commit SHA: `ec7cf5c`
- Deployment provider: Vercel

## 2. Health Check

- Timestamp (UTC): 2026-02-12 05:45
- Request: `GET https://literary-ai-partner.vercel.app/api/health`
- Expected: HTTP 200 OK with an “ok: true” style payload
- Actual status: 200
- Response body (sanitized):

```json
{"ok":true,"timestamp":"2026-02-12T05:45:35.770Z","environment":"production","commit":"ec7cf5c","branch":"main","config":{"has_supabase_url":true,"has_supabase_service_key":true,"has_cron_secret":false,"has_openai_key":false}}
```

**Conclusion:** ✅ PASS – Production health endpoint working. Environment variables are configured (Supabase URL + service key present).

## 3. Job Listing Endpoint

- **Timestamp (UTC):** 2026-02-12 06:15:14
- **Request:** `GET https://literary-ai-partner.vercel.app/api/jobs`
- **Expected:** HTTP 200 with `{ jobs: [...] }`
- **Actual status:** `500 Internal Server Error`
- **Response:**
  ```
  HTTP/2 500
  content-length: 0
  x-matched-path: /api/jobs
  ```

**Conclusion:** ❌ FAIL – `/api/jobs` endpoint exists (route matched) but returns 500 error. Runtime failure in `getAllJobs()`.

### Diagnosis

Route at `app/api/jobs/route.ts` is deployed, but GET handler crashes. Most likely cause: database schema mismatch or query error in production Supabase.

### Next Steps

- [ ] Check Vercel function logs for detailed error stacktrace
- [ ] Verify production database has `jobs` table with correct schema  
- [ ] Test manually: `supabase db pull` to see production schema
- [ ] Fix and redeploy

## 4. Job Creation (Blocked)

**Status:** ⏸️ BLOCKED – Cannot test until GET /api/jobs is fixed

## 5. Overall Phase E1 Verdict

**Status:** ❌ PARTIALLY FAILED

### What Works ✅
- Health endpoint: 200 OK
- Environment variables configured
- Next.js deployed and running

### What's Broken ❌
- `/api/jobs` GET returns 500
- Cannot complete job creation/execution tests

### Root Cause
Production database schema issue or query error in `getAllJobs()`.

### Action Items
1. Check Vercel logs at: https://vercel.com/mmeraw/literary-ai-partner/deployments
2. Verify production Supabase `jobs` table exists
3. Fix and retest within 24 hours
