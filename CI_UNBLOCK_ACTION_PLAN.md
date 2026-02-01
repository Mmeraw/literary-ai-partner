# CI Unblock Action Plan

## Status: 2 of 4 Fixed, 2 Require Manual Steps

### ✅ Fixed in Code (Pushed to main)

1. **Build crash: "supabaseKey is required"**
   - **Fix**: Lazy-loaded Supabase store in `lib/jobs/store.ts`
   - **Commit**: 49c10c9 - Defers `require('./jobStore.supabase')` until runtime
   - **Verification**: Next build will complete without crash

2. **Staging tests: fetch failures**
   - **Fix**: `.github/workflows/ci-staging-tests.yml` now starts server before tests
   - **Commit**: 732c635 - Builds, starts Next.js on port 3000, waits for ready, runs tests with BASE_URL
   - **Verification**: Fetch tests will connect to running server

---

### ⏳ Requires Manual Action

3. **Phase 2D Evidence Gate: Project ref mismatch**
   - **Issue**: GitHub secrets pointed to mixed Supabase projects
   - **Action Required**: Update all 5 secrets to **PRODUCTION ONLY** (`xtumxjnzdswuumndcbwc`)
   
   **Option 1: Via GitHub UI**
   1. Go to: https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions
   2. For each of these 5 secrets, click Edit and paste PRODUCTION value:
      - `SUPABASE_URL` → `https://xtumxjnzdswuumndcbwc.supabase.co`
      - `NEXT_PUBLIC_SUPABASE_URL` → `https://xtumxjnzdswuumndcbwc.supabase.co`
      - `SUPABASE_SERVICE_ROLE_KEY` → (from PRODUCTION dashboard → Settings → API → service_role)
      - `SUPABASE_ANON_KEY` → (from PRODUCTION dashboard → Settings → API → anon)
      - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → (same as SUPABASE_ANON_KEY)
   
   **Option 2: Via CLI**
   ```bash
   ./RESTORE_PROD_SECRETS.sh
   ```
   
   **Verification**:
   ```bash
   git commit --allow-empty -m "test: verify secrets" && git push
   gh run watch
   # Check Phase 2D Evidence logs for: "✅ All key refs match URL project ref: xtumxjnzdswuumndcbwc"
   ```

4. **DB Schema drift: lease_until column missing**
   - **Issue**: PRODUCTION DB doesn't have `evaluation_jobs.lease_until` column
   - **Action Required**: Apply migration to PRODUCTION Supabase project
   
   **Option 1: Via Supabase Dashboard**
   1. Go to: https://supabase.com/dashboard/project/xtumxjnzdswuumndcbwc/editor
   2. Click "SQL Editor"
   3. Paste content from: `supabase/migrations/20260128000001_add_eval_job_lease_fields.sql`
   4. Click "Run"
   
   **Option 2: Via CLI**
   ```bash
   # Get PRODUCTION database password from Supabase dashboard
   npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres"
   ```
   
   **Verification**:
   ```bash
   # Run query in Supabase SQL editor or via psql:
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name='evaluation_jobs' AND column_name='lease_until';
   
   # Should return:
   # lease_until | timestamp with time zone
   ```

---

## Execution Order (Critical)

**DO THESE IN ORDER:**

1. **Fix secrets first** (blocks everything)
   - CI cannot proceed until project refs align
   - Phase 2D Evidence Gate is gating workflow

2. **Apply migration** (blocks worker tests)
   - Worker code references `lease_until` column
   - Tests will fail with "column does not exist"

3. **Verify CI passes**
   - Push any commit or re-run workflows
   - All 4 issues should be resolved

---

## Post-Fix: Best Practice Recommendation

**Create dedicated staging/CI Supabase project:**

1. New project: `revisiongrade-staging` (via https://supabase.com/dashboard)
2. Apply all migrations:
   ```bash
   npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.[staging-ref].supabase.co:5432/postgres"
   ```
3. Update CI secrets to point to staging project
4. Update `docs/SUPABASE_PROJECTS.md` to document new policy

**Benefits:**
- CI tests don't mutate production data
- Production service_role key not exposed in CI logs
- Schema changes can be tested in staging before production
- Isolated environment for destructive tests

**Risk with current setup:**
- CI runs against production database
- Test data may pollute production
- Failed tests could corrupt production state

See: `SECURITY_URGENT_ACTION_REQUIRED.md` Option C for full details

---

## Summary

**Code fixes pushed:**
- Build crash: Fixed via lazy-loading
- Staging tests: Fixed via server startup in workflow

**Manual steps required:**
- Secrets: Update 5 GitHub secrets to PRODUCTION project
- Migration: Apply lease_until column to PRODUCTION DB

**After manual steps:**
- PR #12 can be merged
- All CI workflows should pass
- Consider creating staging project for safety

**Current state:**
- 2 fixes in code (will work once manual steps done)
- 2 blockers remain (require GitHub UI + Supabase Dashboard access)
