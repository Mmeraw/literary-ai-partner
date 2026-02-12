# Phase 2E — Canonical user_id RLS migrations ⏳ BLOCKED: Verification Method Invalid

**Status:** ⏳ BLOCKED (pg_policies not exposed via REST API)  
**Date:** 2026-02-11 (original work) → 2026-02-12 (gate implementation & discovery)  
**Evidence Anchor:** [`7c37c60`](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60) — docs(phase2e): record canonical user_id RLS migrations + proof  
**Governance:** [phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml) (CI verification gate - fail-closed)

## Scope: Canonical user_id Enforcement

Enforce canonical `user_id` field (mapped to `auth.uid()`) across all Row-Level Security (RLS) policies to ensure strict user isolation.

## Status: Verification Method Invalid

**Discovery from Run #6 (21938971620):**
```
HTTP Status: 404
Response: {"code":"PGRST205","message":"Could not find the table 'public.pg_policies' in the schema cache"}
```

**Root Cause:** The `pg_policies` system view is NOT exposed by Supabase's PostgREST API. PostgREST only exposes user tables/views, not internal PostgreSQL catalogs.

**Attempts to Date:**
1. Run #1-2: Broken query (wrong filter, missing headers) → false positive success
2. Run #3-4: Fixed fail-closed logic, query still broken
3. Run #5: Query corrected, but logs invisible (bash redirect bug)
4. Run #6: Observability fixed → **discovered endpoint doesn't exist**

**Commits:**
- [3579832](https://github.com/Mmeraw/literary-ai-partner/commit/3579832): `fix(phase2e): make evidence gate fail-closed + honest claims`
- [56d506e](https://github.com/Mmeraw/literary-ai-partner/commit/56d506e): `fix(phase2e): correct query method + add diagnostics`
- [52d99fd](https://github.com/Mmeraw/literary-ai-partner/commit/52d99fd): `fix(phase2e): ensure output visible even on failure (tee pattern)`

## Alternative Verification Approaches

### Option A: Create RPC Function (Recommended)
Create a `verify_rls_policies()` RPC function that queries `pg_policies` directly via SQL and returns JSON. This is the most auditable and maintainable approach.

**Implementation:**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_rls_verification_rpc.sql
CREATE OR REPLACE FUNCTION public.verify_rls_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'tablename', tablename,
      'policyname', policyname,
      'permissive', permissive,
      'roles', roles,
      'cmd', cmd
    )
  )
  INTO result
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('manuscripts', 'manuscript_chunks');
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_rls_policies() TO service_role;
```

**Usage in CI:**
```bash
curl "$SUPABASE_URL/rest/v1/rpc/verify_rls_policies" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY"
```

### Option B: Supabase CLI
Use `supabase db inspect policies --project-ref xtumxjnzdswuumndcbwc` with project access token. Requires installing Supabase CLI in CI workflow.

### Option C: Narrow Scope to Match Reality
If policies don't exist in production, mark Phase 2E as "⏸️ DEFERRED (aspirational)" until migrations are applied.

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
