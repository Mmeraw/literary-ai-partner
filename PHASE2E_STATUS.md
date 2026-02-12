# Phase 2E — Canonical user_id RLS migrations ✅ LOCKED

**Status:** ✅ LOCKED  
**Date:** 2026-02-11 (original work) → 2026-02-12 (gate implementation & resolution)  
**CI Lock Commit:** [`811fe59`](https://github.com/Mmeraw/literary-ai-partner/commit/811fe59) — refactor(ci): rewrite Phase 2E with proper Python script and error handling  
**Documentation Lock Commit:** [`e7812b6`](https://github.com/Mmeraw/literary-ai-partner/commit/e7812b6) — docs(phase2e): clarify dual lock commits + validate both tables explicitly  
**Governance:** [phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml) (CI verification gate - passing)  
**Latest CI Run:** [#21960401805](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21960401805) — ✅ SUCCESS  
**Canonical Evidence:** [PHASE2E_CANONICAL_EVIDENCE.md](PHASE2E_CANONICAL_EVIDENCE.md)

## Scope: Canonical user_id Enforcement

Enforce canonical `user_id` field (mapped to `auth.uid()`) across all Row-Level Security (RLS) policies to ensure strict user isolation.

## Resolution: RPC Function Implementation

**Resolution (2026-02-12):** Created `verify_phase2e_rls_policies()` RPC function to query `pg_policies` directly via SQL, bypassing PostgREST API limitations.

**Implementation Journey:**
1. Run #1-6: Initial attempts to query pg_policies via REST API → discovered API doesn't expose system catalogs
2. Created RPC migration (`20260212_phase2e_verify_rls_policies_rpc.sql`) to enable SQL-based policy verification
3. Rewrote CI workflow with:
   - Proper Python validation script (separate file, readable logic)
   - Correct error handling (`set +e` / `set -e` pattern)
   - Exit code capture before checking
   - `|| true` on function calls to prevent premature exit

**Final commits:**
- [811fe59](https://github.com/Mmeraw/literary-ai-partner/commit/811fe59): `refactor(ci): rewrite Phase 2E with proper Python script and error handling`
- [5426a3b](https://github.com/Mmeraw/literary-ai-partner/commit/5426a3b): `fix(ci): capture Python exit code before checking it`
- [6ecf83c](https://github.com/Mmeraw/literary-ai-partner/commit/6ecf83c): `fix(ci): replace heredoc with inline Python for YAML+bash compatibility`
- [20567a9](https://github.com/Mmeraw/literary-ai-partner/commit/20567a9): `docs(phase2e): update status to LOCKED with canonical evidence`
- [e7812b6](https://github.com/Mmeraw/literary-ai-partner/commit/e7812b6): `docs(phase2e): clarify dual lock commits + validate both tables explicitly`

## RPC Implementation

**Migration:** `supabase/migrations/20260212_phase2e_verify_rls_policies_rpc.sql`

Creates a `verify_phase2e_rls_policies()` RPC function that queries `pg_policies` system view directly via SQL and returns structured data.

**Function Signature:**
```sql
CREATE OR REPLACE FUNCTION public.verify_phase2e_rls_policies()
RETURNS TABLE (
  schemaname text,
  tablename text,
  rls_enabled boolean,
  rls_forced boolean,
  policyname text,
  cmd text,
  roles name[],
  qual text,
  with_check text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
```

**Security:**
- `SECURITY DEFINER` allows querying system catalogs
- Execute permission granted ONLY to `service_role`
- Public access revoked

**Usage:**
```bash
curl -X POST "$SUPABASE_URL/rest/v1/rpc/verify_phase2e_rls_policies" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Acceptance Criteria Checklist

- ✅ RLS policies exist on `manuscripts` table (9 policies verified)
- ✅ RLS policies exist on `manuscript_chunks` table (2 policies verified)
- ✅ Evidence gate workflow is fail-closed (exits non-zero on any failure)
- ✅ All policy checks pass on main branch (CI run #21960401805 SUCCESS)
- ✅ Closure commit locked ([e7812b6](https://github.com/Mmeraw/literary-ai-partner/commit/e7812b6))

## Evidence & Verification

**Latest Run Evidence ([#21960401805](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21960401805)):**
```
=== Phase 2E Evidence Verification ===
Timestamp: 2026-02-12T19:05:23Z
Commit: 811fe5969c5f6715f4aa86f3693ce1a3842a2450

Calling RPC: ***/rest/v1/rpc/verify_phase2e_rls_policies
  HTTP Status: 200

  ✓ manuscripts OK
  ✓ manuscript_chunks OK

=== Phase 2E Verification Summary ===
Checks passed: 1
Checks failed: 0

✅ Phase 2E Evidence: LOCKED
```

**Artifacts:**
- [CI Evidence Log](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21960401805/artifacts/5488261620) (90-day retention)
- Local Evidence: [20260212_phase2e_evidence_output.txt](20260212_phase2e_evidence_output.txt)

**How to Re-run:**
```bash
# Via CI
gh workflow run phase2e-evidence.yml

# Local verification (requires secrets)
bash scripts/evidence-phase2e.sh
```
