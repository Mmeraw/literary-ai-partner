# CI Failures — Root Cause & Fixes

## Issue 1: Phase 2D Evidence Gate — Project Ref Mismatch

**Error:**
```
URL ref: ngfszuqjoyixmtlbthyv
service role ref: ngfszuqjoyixmtlbthyv
anon ref: xtumxjnzdswuumndcbwc
❌ MISMATCH detected!
```

**Root Cause:**  
GitHub Actions secrets pointed to mixed projects (TEST + PRODUCTION).

**Policy:**  
Per `docs/SUPABASE_PROJECTS.md`, "All CI/CD workflows" use **PRODUCTION** (`xtumxjnzdswuumndcbwc`).

**Fix:**  
Update all 5 GitHub secrets to PRODUCTION project at:  
https://github.com/Mmeraw/literary-ai-partner/settings/secrets/actions

Or run:
```bash
./RESTORE_PROD_SECRETS.sh
```

**Note:**  
CI hitting production is risky. Best practice: create dedicated staging/CI project.

---

## Issue 2: Build Failure — "supabaseKey is required"

**Error:**
```
Error occurred prerendering page "/api/jobs/[jobId]/run-phase2"
Error: supabaseKey is required
```

**Root Cause:**  
- `lib/supabase.js` reads env vars at module import time (lines 5-9)
- During `next build`, placeholders like `"https://placeholder.supabase.co"` are strings (not empty)
- Code doesn't return null, later crashes trying to use invalid client
- Route `app/api/jobs/[jobId]/run-phase2/route.ts` imports this transitively

**Legitimate Options:**

### Option A: Dynamic imports (preferred)
Move Supabase store require into function body in `lib/jobs/store.ts`:
```typescript
if (USE_SUPABASE) {
  // Defer import until first use
  const loadSupabaseStore = () => require("./jobStore.supabase");
  createJob = (...args) => loadSupabaseStore().createJob(...args);
  // etc.
}
```

### Option B: Guard at module level
In `lib/supabase.js`, add stricter check:
```javascript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Reject placeholder values during build
if (SUPABASE_URL?.includes('placeholder') || SUPABASE_ANON_KEY?.includes('placeholder')) {
  // Build-time: skip client creation
  export const getSupabaseClient = () => null;
  export const getSupabaseAdminClient = () => null;
} else {
  // Runtime: normal client creation
  // ... existing code
}
```

### Option C: Route-level guard
In `app/api/jobs/[jobId]/run-phase2/route.ts`, defer imports:
```typescript
export async function POST(req: NextRequest, ctx: { params: Params }) {
  const { getJob, canRunPhase } = await import("@/lib/jobs/store");
  const { runPhase2 } = await import("@/lib/jobs/phase2");
  // ... rest of handler
}
```

**Recommendation:**  
Option A (dynamic imports) is cleanest — keeps build-time deterministic, runtime safe.

---

## Issue 3: DB Schema Mismatch — "lease_until does not exist"

**Error:**
```
column evaluation_jobs.lease_until does not exist
hint: 'Perhaps you meant to reference the column...'
```

**Root Cause:**  
Migration `20260128000001_add_eval_job_lease_fields.sql` not applied to PRODUCTION Supabase project.

**Proof:**  
Local DB has column:
```
 column_name |        data_type         
-------------+--------------------------
 lease_until | timestamp with time zone
```

**Fix:**  
Apply migration to PRODUCTION project (`xtumxjnzdswuumndcbwc`):

```bash
npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.xtumxjnzdswuumndcbwc.supabase.co:5432/postgres"
```

Or via Supabase Dashboard → SQL Editor:
```sql
ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS lease_token UUID;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

ALTER TABLE public.evaluation_jobs
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_status_lease
  ON public.evaluation_jobs (status, lease_until);

CREATE INDEX IF NOT EXISTS idx_evaluation_jobs_worker_id
  ON public.evaluation_jobs (worker_id);
```

---

## Issue 4: Staging Tests — "fetch failed"

**Error:**
```
TypeError: fetch failed
  at tests/admin-dead-letter.test.ts
```

**Root Cause:**  
CI workflow runs `npm run test:staging` directly — no Next.js server is started.  
Tests try to fetch from `baseUrl`, which doesn't exist.

**Fix Applied:**  
Updated `.github/workflows/ci-staging-tests.yml` to:
1. Build Next.js: `npm run build`
2. Start server in background: `npm start -- -p 3000 &`
3. Wait for server: `curl http://127.0.0.1:3000/` until 200
4. Run tests with `BASE_URL=http://127.0.0.1:3000`
5. Stop server after tests

Updated `tests/admin-dead-letter.test.ts` to read `BASE_URL` from env:
```typescript
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
```

---

## Execution Order

1. **Fix secrets** (blocks everything): Update GitHub secrets to PRODUCTION project
2. **Apply migration** (blocks worker tests): Push `lease_until` columns to production DB
3. **Fix build crash** (blocks CI): Implement Option A/B/C above
4. **Staging tests fixed**: Already applied via workflow + test updates

---

## Verification

After fixes applied:

```bash
# 1. Verify secrets aligned
gh workflow run phase2d-evidence.yml
# Check logs: "✅ All key refs match URL project ref: xtumxjnzdswuumndcbwc"

# 2. Verify schema
psql "$SUPABASE_PRODUCTION_URL" -c "\d evaluation_jobs" | grep lease_until
# Should show: lease_until | timestamp with time zone

# 3. Verify build succeeds
npm run build
# Should complete without "supabaseKey is required"

# 4. Verify staging tests pass
npm run build && npm start -- -p 3000 &
BASE_URL=http://127.0.0.1:3000 npm run test:staging
# Should pass all fetch-based tests
```

---

## Best Practice Recommendation

**Create dedicated staging/CI Supabase project:**

1. New project: `revisiongrade-staging` (or `ci-testing`)
2. Apply all migrations to staging
3. Update CI secrets to point to staging project
4. Keep production project isolated from CI test runs

This eliminates risk of:
- CI tests mutating production data
- CI exposing production service_role key
- Schema drift between environments

Documented in: `SECURITY_URGENT_ACTION_REQUIRED.md` Option C
