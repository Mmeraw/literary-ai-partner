# CI Supabase Project Setup

Type: NORMATIVE
Status: ACTIVE
Last Updated: 2026-02-05
Owner: RevisionGrade Governance

## Overview

Job System CI now uses a **dedicated CI-only Supabase project** to avoid schema drift issues and prevent test traffic from hitting production.

## Why CI-Only Project?

**Problem**: Production Supabase database was missing columns the code expected:
- `manuscripts.storage_bucket` / `storage_path` 
- `manuscript_chunks.last_error`

**Solution**: Separate CI database with latest schema, independent of production migrations.

## Setup Steps

### 1. Create CI Supabase Project

1. Go to [supabase.com](https://supabase.com) and create new project
2. Recommended name: `literary-ai-partner-ci`
3. Note the project details:
   - Project URL (e.g., `https://abcd1234.supabase.co`)
   - Anon key (from Settings → API)
   - Service role key (from Settings → API)

### 2. Apply Schema to CI Project

**Option A: Run migrations (recommended)**

```bash
# Link to CI project
supabase link --project-ref YOUR_CI_PROJECT_REF

# Push all migrations
supabase db push
```

**Option B: Export from dev and import**

```bash
# Export schema from dev (no data)
pg_dump --schema-only --no-owner --no-acl \
  "postgresql://[dev-connection-string]" \
  > ci-schema.sql

# Import into CI project via Supabase SQL editor
# Or use: psql -f ci-schema.sql "postgresql://[ci-connection-string]"
```

**Critical columns to verify exist in CI:**

```sql
-- Check manuscripts table
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='manuscripts'
ORDER BY column_name;

-- Must have at minimum: id, title, file_url

-- Check manuscript_chunks table  
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema='public' AND table_name='manuscript_chunks'
ORDER BY column_name;

-- Must have: id, job_id, chunk_order, status, last_error, etc.
```

### 3. Add GitHub Secrets

Add these repository secrets via GitHub UI or CLI:

```bash
gh secret set SUPABASE_URL_CI \
  --body "https://YOUR_CI_PROJECT.supabase.co"

gh secret set SUPABASE_ANON_KEY_CI \
  --body "eyJhbGc..."  # CI project anon key

gh secret set SUPABASE_SERVICE_ROLE_KEY_CI \
  --body "eyJhbGc..."  # CI project service role key

gh secret set SUPABASE_PROJECT_REF_CI \
  --body "xtumxjnzdswuumndcbwc"  # CI project short ref (NOT the URL)

gh secret set SUPABASE_ACCESS_TOKEN_CI \
  --body "sbp_..."  # Supabase personal access token for CLI
```

### 4. Verify Workflow Configuration

The workflow ([.github/workflows/job-system-ci.yml](.github/workflows/job-system-ci.yml)) has been updated to:

✅ Use `SUPABASE_URL_CI`, `SUPABASE_ANON_KEY_CI`, `SUPABASE_SERVICE_ROLE_KEY_CI`  
✅ Override canonical env var names (`NEXT_PUBLIC_SUPABASE_URL`, etc.)  
✅ Set `JOB_SYSTEM_ENV=ci` flag for audit logging  
✅ Remove `ALLOW_DEV_PROD` bypass (no longer needed)

### 5. Proof in Actions (Audit Evidence)

On the next workflow run, verify:

- **Check Proof Gate Availability** prints `secrets_ok=true`
- **Supabase-Backed Job Tests** is not skipped
- Logs show:
  - `SUPABASE_URL_CI present? true`
  - `SUPABASE_PROJECT_REF_CI present? true`
- Artifact uploaded: `supabase-contract-test-logs`

### 6. Test Data Setup

Create test manuscript in CI project:

```sql
-- Insert test manuscript (ID 999001 used by smoke tests)
INSERT INTO public.manuscripts (id, title, file_url, author, created_at, updated_at)
VALUES (
  999001,
  'CI Test Manuscript',
  'https://example.com/test.txt',  -- Or use actual test file
  'CI Test Author',
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  updated_at = now();
```

## Architecture Benefits

### Blast Radius
- CI tests only touch CI project
- Production database unaffected by test traffic
- Safe to run aggressive smoke tests

### Schema Evolution
- CI project tracks latest code schema
- Production migrations are deliberate, audited steps
- No more "column does not exist" surprises in CI

### Secrets Isolation
- CI service role key separate from production
- Test users and test data segregated
- Easier audit trail (separate projects)

## Migration Path

**Before (drift-prone)**:
```
Code (HEAD) → Production DB (stale schema) → CI fails ❌
```

**After (audit-grade)**:
```
Code (HEAD) → CI DB (aligned schema) → CI passes ✅
              Production DB ← Deliberate migration
```

## Troubleshooting

### "CI Supabase credentials not configured"

The workflow will skip Supabase tests if secrets aren't set. Add all required `_CI` secrets (URL, anon key, service role key, project ref, access token).

### Schema still mismatched

1. Verify migrations ran against CI project
2. Check columns exist via SQL queries above
3. Ensure `JOB_SYSTEM_ENV=ci` is set in workflow

### Local dev still using production

Local dev continues using `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`.  
CI credentials only override in GitHub Actions environment.

## Maintenance

- **On schema changes**: Update CI project first, then production when ready
- **Test data**: Periodically refresh CI project with realistic test data
- **Monitoring**: CI project usage should be test-only (no user traffic)

## Rollback Plan

If issues arise, temporarily revert to production database:

1. Change workflow secrets back to `NEXT_PUBLIC_SUPABASE_URL` (prod)
2. Re-add `ALLOW_DEV_PROD=I_UNDERSTAND_THE_RISK` 
3. But fix forward by completing CI project setup properly

## Current Status & Known Issues

The following table represents the current, audit-verified state of CI Supabase integration.
Findings are based on executed workflows and retained artifacts.

| Defect | Finding | Truth |
|--------|---------|-------|
| Admin Retry Atomicity Test (A5) | RPC migration not applied to CI Supabase; test cannot run | Admin retry atomicity guarantees cannot be validated until RPC overload is resolved. |
| Database Schema Drift | CI project schema may lag behind repo migrations | In progress: migrations apply step added to workflow |
| Secrets Configuration | All required CI secrets present to enable proof gates | Configure SUPABASE_URL_CI, SUPABASE_SERVICE_ROLE_KEY_CI, SUPABASE_PROJECT_REF_CI, SUPABASE_ACCESS_TOKEN_CI |

---

**Status**: ✅ Code changes committed  
**Next**: Add GitHub secrets and verify CI passes
