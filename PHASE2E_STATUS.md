# Phase 2E — Canonical user_id RLS migrations ⏳ INCOMPLETE

**Status:** ⏳ EVIDENCE GATE FAILED (Policies Not Found)  
**Date:** 2026-02-11 (original work) → 2026-02-12 (gate verification)  
**Evidence Anchor:** [`7c37c60`](https://github.com/Mmeraw/literary-ai-partner/commit/7c37c60) — docs(phase2e): record canonical user_id RLS migrations + proof  
**Governance:** [phase2e-evidence.yml](.github/workflows/phase2e-evidence.yml) (CI verification gate - fail-closed)

## Scope: Canonical user_id Enforcement

Enforce canonical `user_id` field (mapped to `auth.uid()`) across all Row-Level Security (RLS) policies to ensure strict user isolation.

## Status: Evidence Gate Failed

**Latest Gate Run:** [Run #21938474172](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938474172) (2026-02-12T08:07:27Z)  
**Conclusion:** ❌ FAILED (exit code 1)  
**Finding:**
```
✗ FAILED: No manuscripts RLS policies found
✗ FAILED: No manuscript_chunks RLS policies found
Checks failed: 2
❌ Phase 2E Evidence: FAILED
```

**What This Means:**
- The RLS policies claimed in commit 7c37c60 are not accessible or do not exist in production
- The Supabase API `/rest/v1/pg_policies` endpoint returned no `policyname` field for these tables
- The gate is now **fail-closed**: it correctly rejects incomplete or unverifiable claims
- This is honest governance—the gate won't lie to make Phase 2E look "done"

## Why This Is Actually Good Governance

Your evidence gate caught what the narrative hid: Phase 2E work was documented, but the actual RLS policies aren't verifiable. The gate now prevents false-positive "LOCKED" claims.

## Next Steps (To Actually Complete Phase 2E)

1. **Verify what policies actually exist in production:**
   ```bash
   # Query production Supabase directly
   curl -s \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     "https://xtumxjnzdswuumndcbwc.supabase.co/rest/v1/pg_policies"
   ```

2. **If policies DO exist:**
   - Update the gate script to check for the correct policy names/tables
   - Re-run: gate should pass, Phase 2E locks as done

3. **If policies DON'T exist:**
   - Apply the migrations described in 7c37c60
   - Re-run gate
   - Lock Phase 2E only after gate passes

## Acceptance Criteria Checklist

- ❌ RLS policies exist on `manuscripts` table (FAILED: not found)
- ❌ RLS policies exist on `manuscript_chunks` table (FAILED: not found)
- ✅ Evidence gate workflow is fail-closed (exits non-zero on missing policies)
- ❌ All policy checks pass on main branch 
- ❌ Closure commit locked (BLOCKED: gate not passing)

## Evidence

**Gate Implementation (Fail-Closed):**
- CI Workflow: `.github/workflows/phase2e-evidence.yml`
- Verification: Supabase API `/rest/v1/pg_policies` endpoint
- Exit code 0 only if all policy existence checks pass
- Exit code 1 if any expected policy table lacks policies
- Prevents "success" status when verification fails (audit-safe)

**Run Evidence (GitHub Actions):**
- **Latest Run:** [Run #21938474172](https://github.com/Mmeraw/literary-ai-partner/actions/runs/21938474172) (2026-02-12T08:07:27Z - fail-closed)
- **Status:** ❌ Completed with failure (exit 1)
- **Gate Output:**
  ```
  Checking manuscripts table RLS policies...
    ✗ FAILED: No manuscripts RLS policies found
  
  Checking manuscript_chunks table RLS policies...
    ✗ FAILED: No manuscript_chunks RLS policies found
  
  === Phase 2E Verification Summary ===
  Checks passed: 0
  Checks failed: 2
  ❌ Phase 2E Evidence: FAILED
  ```

**How to Verify Current Status:**
```bash
# View latest gate run
gh run list --workflow phase2e-evidence.yml -L 1

# View detailed logs
gh run view 21938474172 --log

# Run verification script locally (requires SUPABASE_URL + KEY)
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ./scripts/evidence-phase2e.sh
```

## Closed

This phase is **BLOCKED** until the evidence gate passes. The RLS policies claimed in 7c37c60 must either be:
1. Verified to exist in production (update gate script if needed), OR
2. Actually applied to production (re-run migrations if needed)

No Phase 2E "LOCKED" status can be claimed without the gate passing.
