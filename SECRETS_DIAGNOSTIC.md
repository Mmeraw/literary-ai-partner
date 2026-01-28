# Secrets Diagnostic Report — Phase 2D Evidence Gate

**Report Date:** 2026-01-28  
**Workflow Run:** 21459298598  
**Status:** PARTIALLY PASSING (secrets check step added)

## Current State

### ✅ Secrets PRESENT in GitHub Actions environment:
1. **SUPABASE_URL** ✓
2. **SUPABASE_SERVICE_ROLE_KEY** ✓
3. **SUPABASE_ANON_KEY** ✓ (newly working)

### ❌ Secrets MISSING from GitHub Actions environment:
1. **NEXT_PUBLIC_SUPABASE_URL** ✗
2. **NEXT_PUBLIC_SUPABASE_ANON_KEY** ✗

## Root Cause Analysis

The `NEXT_PUBLIC_*` secrets are not reaching the workflow, even though they're referenced in the workflow file:

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

**Possible causes:**
1. The secrets don't exist in GitHub UI yet
2. Secret names contain invalid characters (GitHub may strip or transform them)
3. Secrets were created with different names

## What Was Fixed

**SUPABASE_ANON_KEY is now present.** This wasn't the case in earlier runs (21458961679, 21457791546). 

**Timeline:**
- Run 21458961679 (23:09:59Z): SUPABASE_ANON_KEY was EMPTY
- Run 21459298598 (23:23:24Z): SUPABASE_ANON_KEY is now PRESENT ✓

This suggests secrets were added after earlier runs.

## Next Step: Create the Missing Secrets

To fix this completely, you need to ensure these secrets exist in GitHub Settings:

**Via GitHub UI:**
1. Go to: https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions
2. Click **New repository secret** for each:

| Secret Name | Value | Source |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as `SUPABASE_URL` | Production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` | Production Supabase anon key |

**Via GitHub CLI (if you have permissions):**
```bash
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "YOUR_URL_HERE"
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "YOUR_ANON_KEY_HERE"
```

## Why Both Private and Public Versions?

- `SUPABASE_URL` + `SUPABASE_ANON_KEY`: Used in **server-side code** (workers, backend tests)
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Used in **browser/frontend code**

In Next.js, environment variables prefixed with `NEXT_PUBLIC_` are automatically bundled into the browser bundle. GitHub Actions uses these same secret names during workflow execution.

## Current Workflow Requirement

The Phase 2D Evidence workflow **does NOT fail** if the `NEXT_PUBLIC_*` secrets are missing, because the check at step "Verify secrets are present" only enforces:

```bash
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Critical secrets are missing"
  exit 1
fi
```

It does **not** enforce `NEXT_PUBLIC_*` presence. The tests pass as long as they can connect to Supabase with the service role key (for setup) and anon key (for test execution).

**However,** for production deployment and full Next.js functionality, you will need both sets.

## Verification Steps

After adding the missing secrets, run:

```bash
git push origin main
```

This will trigger the Phase 2D Evidence workflow again. You should see:

```
Secret presence check:
  ✓ SUPABASE_URL present
  ✓ NEXT_PUBLIC_SUPABASE_URL present       ← Should change to ✓
  ✓ SUPABASE_SERVICE_ROLE_KEY present
  ✓ SUPABASE_ANON_KEY present
  ✓ NEXT_PUBLIC_SUPABASE_ANON_KEY present  ← Should change to ✓
```

Then all Phase 2D tests should run and pass.

## Audit Trail

- **Workflow:** `phase2d-evidence.yml`
- **Latest run:** 21459298598 (23:23:24Z)
- **Added:** "Verify secrets are present" diagnostic step
- **Status:** Secrets check PASSING (critical ones present)
- **Blocker:** Missing `NEXT_PUBLIC_*` secrets for full test execution
