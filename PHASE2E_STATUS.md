# Phase 2E — Canonical user_id RLS migrations ⏳ VERIFICATION IN PROGRESS

**Status:** ⏳ QUERY METHOD CORRECTED (Re-running verification)  
**Date:** 2026-02-11 (original work) → 2026-02-12 (gate implementation & correction)  
**Evidence Anchor:** [`7c37c60`](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60) — docs(phase2e): record canonical user_id RLS migrations + proof  
**Governance:** [phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml) (CI verification gate - fail-closed)

## Scope: Canonical user_id Enforcement

Enforce canonical `user_id` field (mapped to `auth.uid()`) across all Row-Level Security (RLS) policies to ensure strict user isolation.

## Status: Query Method Fixed

**Issue Found in Run #21938474172:**
- Query was using wrong filter: `?table_name=eq.manuscripts` → should be `?tablename=eq.manuscripts`
- Missing `apikey` header required by Supabase REST
- Not capturing HTTP status codes, so failures were indistinguishable from empty responses

**Fixes Applied:**
- ✅ Query filter corrected: `tablename` (not `table_name`)
- ✅ HTTP status code capture added (distinguishes 404 vs. 200 vs. errors)
- ✅ Added `apikey` header for Supabase REST authentication
- ✅ Response diagnostics: prints first 150 chars of response body
- ✅ Fail-closed logic: exits 1 if HTTP != 200 OR response is `[]` OR missing `policyname` field

**Commits:**
- [3579832](https://github.com/Mmeraw/literary-ai-partner/commit/3579832): `fix(phase2e): make evidence gate fail-closed + honest claims`
- [0113095](https://github.com/Mmeraw/literary-ai-partner/commit/0113095): `docs(phase2e): record gate failure - policies not found (HONEST status)` (will be superseded)
- Next: Updated scripts/evidence-phase2e.sh + workflow with corrected query

## Expected Outcome (Next Gate Run)

The corrected gate will now return one of:
1. **✅ PASS:** If RLS policies exist and are accessible
2. **❌ HTTP 404/403:** If endpoint not exposed or access denied (shows which)
3. **❌ Empty array `[]`:** If table exists but has no policies (now distinguishable from query failure)
4. **❌ No policyname field:** If response format unexpected (shows response for debugging)

## Acceptance Criteria Checklist

- ⏳ RLS policies exist on `manuscripts` table (verifying with corrected query)
- ⏳ RLS policies exist on `manuscript_chunks` table (verifying with corrected query)
- ✅ Evidence gate workflow is fail-closed (exits non-zero on any failure)
- ⏳ All policy checks pass on main branch (re-running with fixed query)
- ⏳ Closure commit locked (pending gate pass)

## Evidence & Verification Method

**Query Method (Corrected in Latest Commit):**
```bash
# Endpoint: GET /rest/v1/pg_policies
# Filter: tablename=eq.{table_name}
# Headers: 
#   - Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY
#   - apikey: $SUPABASE_ANON_KEY
#   - Content-Type: application/json
```

**Diagnostics Captured:**
- HTTP status code (200 vs. 4xx/5xx errors)
- Response body preview (first 150 chars)
- Presence of `policyname` field (indicates policies exist)

**Gate Implementation (Fail-Closed):**
- Exit code 0 only if HTTP 200 AND response contains policy records
- Exit code 1 if: HTTP != 200 OR response is `[]` OR `policyname` field missing
- Prevents false-positive "LOCKED" status

**Previous Run (Pre-Fix):**
- **Run:** [#21938474172](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938474172)
- **Status:** Failed
- **Issue:** Query used wrong filter (`table_name` instead of `tablename`), missing headers
- **Result:** Cannot determine if policies missing or query method broken

**Next Run (With Corrections):**
- Will clearly distinguish between:
  - ✅ Policies exist and accessible
  - ❌ Policies missing (empty array response)
  - ❌ Query method invalid (HTTP error)
  - ❌ Access denied (403/401)

**How to View Latest Run:**
```bash
# List recent runs
gh run list --workflow phase2e-evidence.yml -L 3

# View specific run
gh run view <RUN_ID> --log | grep -A 50 "=== Phase 2E Verification"
```
