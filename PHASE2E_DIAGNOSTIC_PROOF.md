# Phase 2E Diagnostic Proof — Courtroom-Grade Evidence Trail

**Date:** 2026-02-12  
**Question:** Is Phase 2E (canonical user_id RLS migrations) formally closed?  
**Answer:** ⏳ **BLOCKED** — Verification method is fundamentally invalid

---

## Executive Summary

Phase 2E governance artifacts exist (status doc + CI workflow + evidence script) but **cannot verify production state** because the verification method queries an endpoint that doesn't exist.

**Ground Truth (Run #6: 21938971620):**
```
HTTP Status: 404
Response: {"code":"PGRST205","message":"Could not find the table 'public.pg_policies' in the schema cache"}
```

**Root Cause:** Supabase's PostgREST API does NOT expose the `pg_policies` system view. PostgREST only serves user tables/views, not internal PostgreSQL catalogs.

**Current Status:** BLOCKED until we implement SQL-based verification (RPC function recommended).

---

## Investigation Timeline

### Phase 1: Discovery (Commits daefcfa → 3579832)

**Initial State:**
- Phase 2E status doc existed: [PHASE2E_STATUS.md](PHASE2E_STATUS.md)
- Reference commit `7c37c60`: documents canonical user_id RLS migrations
- No CI verification gate (unlike Phase 2D pattern)

**Action:** Created governance artifacts
- `.github/workflows/phase2e-evidence.yml` (CI gate)
- `scripts/evidence-phase2e.sh` (manual verification)

**First Run (#21938309509):** Gate reported success but logs showed failures → **logically unsafe (fail-open)**

---

### Phase 2: Fail-Closed Gate Implementation (Commit 3579832)

**User Challenge:** "Gate is logically unsafe - converts failures to success"

**Issues Found:**
- Script used `set +e` (suppresses errors)
- Hardcoded `exit 0` (always succeeds)
- Output showed "✗ manuscripts policy NOT found" but concluded "✓ Evidence gate passed"

**Fixes Applied:**
```bash
# Before: set +e ... exit 0
# After: set -eo pipefail ... [ "$CHECKS_FAILED" -eq 0 ] || exit 1
```

**Run #4 (21938527480):** Correctly failed with exit code 1 → **gate now fail-closed ✓**

**Status Updated:** [PHASE2E_STATUS.md](PHASE2E_STATUS.md) → "⏳ INCOMPLETE (Policies Not Found)"

---

### Phase 3: Query Method Correction (Commit 56d506e)

**User Challenge:** "Query itself is broken - wrong field, missing headers"

**Issues Found:**
1. Wrong filter field: `table_name=eq.manuscripts` (should be `tablename=eq.manuscripts`)
2. Missing `apikey` header (Supabase REST requirement)
3. No HTTP status capture (couldn't distinguish errors from empty responses)
4. No response body diagnostics (failures were opaque)

**Fixes Applied:**
```bash
# Corrected query with diagnostics
curl -sS -w "\n__HTTP_STATUS:%{http_code}" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/pg_policies?tablename=eq.$table"
```

**Run #5 (21938758326):** Failed with exit code 1, but output was invisible

---

### Phase 4: Observability Fix (Commit 52d99fd)

**Issue:** Brace redirect pattern `{ ... } > "$OUTPUT_FILE"; cat "$OUTPUT_FILE"` failed to show output when script exited inside braces

**Fix:** Changed to `exec > >(tee "$OUTPUT_FILE") 2>&1` (streams to both stdout AND file)

**Run #6 (21938971620):** Failed with visible output → **discovered root cause**

---

## Ground Truth Discovery (Run #6)

### Definitive Evidence

**Workflow Run:** [#21938971620](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938971620)

**Output:**
```
=== Phase 2E Evidence Verification ===
Timestamp: 2026-02-12T08:25:06Z
Project ID: xtumxjnzdswuumndcbwc

=== Verifying RLS Policies ===

Checking manuscripts table RLS policies...
  HTTP Status: 404
  Response preview: {"code":"PGRST205","details":null,"hint":null,"message":"Could not find the table 'public.pg_policies' in the schema cache"}...

  ✗ FAILED: HTTP 404 (invalid query or access denied)
```

**Interpretation:**
- HTTP 404 = endpoint does not exist
- `PGRST205` = PostgREST error code for "table not in schema cache"
- `pg_policies` = PostgreSQL system view not exposed by Supabase REST API

**Conclusion:** Verification method is fundamentally invalid.

---

## Alternative Verification Methods

### Option A: Create RPC Function (Recommended)

**Why:** Direct SQL access to `pg_policies` system view, auditable, maintainable

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

**CI Usage:**
```bash
curl "$SUPABASE_URL/rest/v1/rpc/verify_rls_policies" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  | jq '.[] | {table: .tablename, policy: .policyname}'
```

### Option B: Supabase CLI

```bash
# Install in CI workflow
npm install -g supabase
supabase db inspect policies --project-ref xtumxjnzdswuumndcbwc --token $SUPABASE_ACCESS_TOKEN
```

**Pros:** Official tooling  
**Cons:** Requires project access token, less auditable

### Option C: Narrow Scope to Match Reality

If RLS policies don't exist in production:
- Mark Phase 2E as "⏸️ DEFERRED (aspirational)"
- Document intended state vs. actual state
- Apply migrations before claiming "LOCKED"

---

## Governance Compliance

### Artifacts Created ✓
- [x] Status document: [PHASE2E_STATUS.md](PHASE2E_STATUS.md)
- [x] CI workflow: [.github/workflows/phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml)
- [x] Evidence script: [scripts/evidence-phase2e.sh](scripts/evidence-phase2e.sh)
- [x] Reference commit: [`7c37c60`](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60)

### Gate Properties ✓
- [x] **Fail-closed:** Exit code 1 when checks fail (commit 3579832)
- [x] **Observable:** Output visible on failure (commit 52d99fd)
- [x] **Honest:** Reports "BLOCKED" not "LOCKED" when verification impossible

### Correctness Issues ❌
- [ ] **Verification method invalid:** pg_policies endpoint doesn't exist
- [ ] **Cannot measure reality:** Need SQL-based verification (RPC or CLI)

---

## Commit Trail

| Commit | Type | Description |
|--------|------|-------------|
| [7c37c60](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60) | docs | Original Phase 2E documentation + proof |
| [daefcfa](https://github.com/Mmeraw/literary-ai-partner/commit/daefcfa) | feat | Create evidence gate (broken query, fail-open logic) |
| [3579832](https://github.com/Mmeraw/literary-ai-partner/commit/3579832) | fix | Make gate fail-closed + honest claims |
| [0113095](https://github.com/Mmeraw/literary-ai-partner/commit/0113095) | docs | Record gate failure honestly |
| [56d506e](https://github.com/Mmeraw/literary-ai-partner/commit/56d506e) | fix | Correct query method + add diagnostics |
| [52d99fd](https://github.com/Mmeraw/literary-ai-partner/commit/52d99fd) | fix | Ensure output visible even on failure (tee pattern) |
| [f8ce314](https://github.com/Mmeraw/literary-ai-partner/commit/f8ce314) | docs | Document discovery: pg_policies not exposed via PostgREST |

---

## Lessons Learned

### 1. Governance Completeness ≠ Correctness
Having artifacts (status doc + CI workflow + script) doesn't mean they **work correctly**.

### 2. Fail-Closed is Non-Negotiable
Gates must refuse to lie about failures. A gate that reports "✓ Evidence gate passed" when checks failed is worse than no gate.

### 3. Observability is Critical
Cannot debug what you cannot see. Brace redirect pattern `{ ... } > file; cat file` breaks on early exit.

### 4. Query Correctness is Verifiable
Capturing HTTP status codes + response bodies makes failures informative. Run #6 definitively proved the endpoint doesn't exist.

### 5. Honest Status Progression
Better to show "⏳ BLOCKED (fixing verification method)" than claim "✅ LOCKED" prematurely.

---

## Answer to Original Question

**"Is Phase 2E formally closed?"**

**No.** Phase 2E status is:

```
⏳ BLOCKED: Verification Method Invalid
```

**Why:**
- Governance artifacts exist but query an endpoint that doesn't exist
- Cannot verify whether RLS policies exist in production
- Need SQL-based verification (RPC function) before claiming "LOCKED"

**What's Proven:**
- ✅ Gate is fail-closed (commit 3579832)
- ✅ Gate is observable (commit 52d99fd)
- ✅ Gate reports honest status (HTTP 404 definitively captured)
- ❌ Gate cannot measure production reality (pg_policies not exposed via REST)

**Next Step:** Implement Option A (RPC function) to enable trustworthy verification.

---

## References

- **Phase 2E Status:** [PHASE2E_STATUS.md](PHASE2E_STATUS.md)
- **Evidence Workflow:** [.github/workflows/phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml)
- **Run #6 (Ground Truth):** https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938971620
- **Reference Commit:** [`7c37c60`](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60)
