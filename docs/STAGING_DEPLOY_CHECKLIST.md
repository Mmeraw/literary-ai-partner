# Staging → Production Deploy Checklist

**Status:** Ready for deployment  
**Last Verified:** 2026-01-22  
**Quality Gate:** Staging smoke runbook passes  
**Total Deploy Time:** ~15 minutes (staging), ~20 minutes (production)

---

## Pre-Deploy (Local Dev)

- [x] `.env.local` has both `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
- [x] `lib/supabase.js` fails fast if service role key is missing
- [x] All write paths use `getSupabaseAdminClient()` (enforced at import)
- [x] `claim_chunk_for_processing` RPC is atomic (SECURITY DEFINER + transactions)

---

## ⛔ When NOT to Deploy (Veto Conditions)

**DO NOT proceed if any of these are true:**

- ❌ Migrations fail locally (`supabase db push` errors)
- ❌ Smoke runbook exits non-zero (anything but exit code `0`)
- ❌ Supabase status page shows incidents (check [status.supabase.com](https://status.supabase.com))
- ❌ Vercel has ongoing incidents (check [vercel.com/status](https://vercel.com/status))
- ❌ You haven't waited 24h since last staging deploy (stability gate)
- ❌ RLS errors in current staging logs (`permission denied`)
- ❌ Function not found errors in logs (`does not exist`)
- ❌ You don't have service role key in Vercel env vars
- ❌ **You're linked to the WRONG Supabase project** (e.g., production instead of staging)
- ❌ You're not sure → ask, don't guess

**Critical check before migrations:**
```bash
supabase status  # Must show your STAGING project reference
# If this shows your PRODUCTION project: DO NOT CONTINUE
# Stop, unlink, verify project ID, then link to correct one
```

**If any veto condition is true:** Stop, investigate root cause, fix locally, test with smoke runbook, then restart.

---

## Staging Deployment (~15 min total)

### 1. Set Vercel Environment Variables — 5 min

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Select **Staging** environment, then add:

```
SUPABASE_SERVICE_ROLE_KEY = <staging-project-service-role-key>
NEXT_PUBLIC_SUPABASE_URL = https://staging-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = <staging-project-anon-key>
NODE_ENV = production
USE_SUPABASE_JOBS = true
```

**Where to find these values:**
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your **staging** project
3. Go to **Settings** → **General**
4. Copy **Project reference** (used in commands below)
5. Go to **Settings** → **API** for service role and anon keys

### 2. Push Migrations — 2 min

**CRITICAL: Verify linked project before pushing**

```bash
# Link to staging project
supabase link --project-ref your-staging-project-id

# CHECK: Confirm you're linked to STAGING, not production
supabase status
# Output should show: Project reference: <staging-project-id>
# If this shows your PRODUCTION project, STOP here and verify the ID
```

**If `supabase status` shows the wrong project, do NOT continue. Stop and investigate.**

```bash
# Push migrations (only after confirming staging above)
supabase db push
```

**Verify:**
```bash
supabase migration list  # All 9 migrations should show ✓ in both Local/Remote columns
```

### 3. Run Smoke Runbook — 30 sec

```bash
export SUPABASE_PROJECT_ID=your-staging-project-id
bash scripts/staging-smoke-runbook.sh staging
```

**Expected output:**
```
✓ Migrations applied successfully
✓ Crash recovery test passed
✓ End-to-end processing completed
✓ Outputs validated
ALL CHECKS PASSED
```

**What "Outputs validated" means (machine-checkable):**
- ✓ All chunks end in `done` or `failed` (with reason)
- ✓ No chunks stuck in `processing` after lease timeout + recovery cycle
- ✓ At least one end-to-end artifact generated
- ✓ Logs contain NO `[RG-SUPABASE] Using ANON key` warnings
- ✓ Logs contain NO RLS denials (`permission denied`)
- ✓ Exit code is `0` (non-zero = failure, don't proceed)

**Exit code:** `0` (quality baseline locked)

### 4. Deploy to Vercel Staging — 5 min

```bash
# Create preview deployment (uses staging env vars)
vercel
```

Wait for deployment to complete in Vercel dashboard.

### 5. Monitor (First Hour & 24h Stability Gate)

**First Hour (Hourly Checks):**
Watch Vercel logs for critical errors:
- ❌ `[RG-SUPABASE] Using ANON key for admin client` → **ROLLBACK**
- ❌ `permission denied` RLS errors → **ROLLBACK**
- ❌ `does not exist` function errors → **ROLLBACK**
- ✅ Chunks transitioning: pending → processing → done

**24h Stability Metrics (Daily Checks):**

Before promoting to production, verify these concrete conditions over 24h:

```
Error rate (RLS denied + function-not-found):  0
Stuck chunks (processing > lease timeout):    0
Successful processing count:                   ≥ baseline from smoke runbook
Vercel function errors:                         0 (or <threshold)
"Using ANON key" warnings:                     0
RLS denials in logs:                           0
```

**If ANY of these are NOT met after 24h, stop and investigate before promotion.**

Example check (after 24h):
```bash
# Query stuck chunks (should be 0)
SELECT COUNT(*) FROM manuscript_chunks WHERE status='processing' AND processing_started_at < NOW() - INTERVAL '15 minutes';
# Expected result: 0 rows
```

Only proceed to production if all 24h metrics are green.

---

## Production Deployment (~20 min total, after 24h staging stability)

### Prerequisites
- [ ] Staging has been running stably for 24+ hours
- [ ] No RLS errors or function-not-found errors in staging logs
- [ ] Ready to switch to production branch + credentials

### 1. Checkout Main Branch & Set Vercel Production Env — 5 min

```bash
git checkout main
git pull origin main
```

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Select **Production** environment, then add:

```
SUPABASE_SERVICE_ROLE_KEY = <prod-project-service-role-key>  ⚠️  DIFFERENT KEY
NEXT_PUBLIC_SUPABASE_URL = https://prod-project.supabase.co   ⚠️  DIFFERENT PROJECT
NEXT_PUBLIC_SUPABASE_ANON_KEY = <prod-project-anon-key>       ⚠️  DIFFERENT KEY
NODE_ENV = production
USE_SUPABASE_JOBS = true
```

### 2. Push Migrations — 2 min

```bash
# Find your-prod-project-id from Supabase Settings → General → Project reference
supabase link --project-ref your-prod-project-id
supabase db push
```

### 3. Final Validation (Smoke Runbook) — 30 sec

```bash
export SUPABASE_PROJECT_ID=your-prod-project-id
bash scripts/staging-smoke-runbook.sh production
# Must exit 0 before proceeding to next step
```

### 4. Deploy to Production — 5 min

```bash
vercel deploy --prod
```

Wait for deployment to complete in Vercel dashboard.

### 5. Monitor First Hour

Watch Vercel logs for:
- ❌ `[RG-SUPABASE] Using ANON key for admin client` → **ROLLBACK** (see below)
- ❌ `claim_chunk_for_processing does not exist` → **ROLLBACK** (see below)
- ❌ Multiple workers claiming same chunk → Check logs for timestamp deltas
- ✅ Chunks transitioning: pending → processing → done
- ✅ Retry behavior working (attempt_count increments on failure)

---

## 🛡️ Schema Changes & Migrations

**All database schema changes must follow this enforced process:**

1. **Create migration locally**
   ```bash
   supabase migration new descriptive_migration_name
   # Edit the generated file in supabase/migrations/
   ```

2. **Test locally first**
   ```bash
   supabase db push
   ```

3. **Commit to staging branch**
   ```bash
   git add supabase/migrations/
   git commit -m "Migration: descriptive_migration_name"
   git push origin staging
   ```

4. **Push to staging Supabase**
   ```bash
   supabase link --project-ref staging-project-id
   supabase db push
   ```

5. **Run smoke runbook on staging** (catches RLS issues)
   ```bash
   bash scripts/staging-smoke-runbook.sh staging
   ```

6. **Wait 24h** for staging stability, then promote to prod

7. **Create PR** (staging → main)

8. **Run smoke runbook on prod** (final validation)
   ```bash
   bash scripts/staging-smoke-runbook.sh production
   ```

9. **Merge to main** only after smoke runbook passes

**Never:**
- ❌ Modify schema directly in Supabase UI (not tracked)
- ❌ Skip smoke runbook before production
- ❌ Merge to main without 24h staging soak
- ❌ Combine multiple unrelated migrations (one per commit)

---

## Rollback Plan

If production has issues:

### Critical (Immediate Rollback)

**Issue:** RLS errors on writes
```
[permission denied] new row violates row-level security policy
```

**Action:**
1. Remove `SUPABASE_SERVICE_ROLE_KEY` from Vercel prod env (revert to staging)
2. Restart deployment
3. Verify logs clear of permission errors
4. Investigate missing secret

**Issue:** Function does not exist
```
function claim_chunk_for_processing does not exist
```

**Action:**
1. Verify migrations applied: `supabase migration list`
2. If missing, run: `supabase db push`
3. Restart workers
4. Re-test with runbook

### Non-Critical (Monitor & Fix Forward)

**Issue:** Stuck chunks not recovering after 15 minutes
- Check: Is `processing_started_at` being set?
- Check: Are workers actually alive? (check for cron heartbeat)
- Solution: Manual invoke of claim function or restart workers

**Issue:** Attempt count not incrementing
- Check: Is optimistic locking succeeding? (log RPC fallback rate)
- Solution: Monitor + let workers self-correct

---

## Monitoring Commands

### Dashboard (Real-time)

```bash
# Vercel logs (production)
vercel logs --prod

# Supabase studio: https://app.supabase.com → your-project
# Watch: manuscript_chunks table, status/attempt_count columns
```

### CLI Diagnostics

```bash
# Query stuck chunks
supabase db select -c prod-project-id manuscript_chunks \
  --where "status=eq.processing,processing_started_at=lt.$(date -u -d '15 minutes ago' +%s)" \
  --limit 10

# Check recent phase 1 results
supabase db select -c prod-project-id manuscript_chunks \
  --where "status=eq.done" \
  --order "updated_at.desc" \
  --limit 5
```

---

## Success Criteria (Post-Deploy)

- [x] No RLS permission errors in logs
- [x] No "function does not exist" errors
- [x] Processing time per chunk < 30 seconds (Phase 1)
- [x] Stuck chunk recovery fires within 20 minutes
- [x] Retry backoff: attempt 1→2 delay ~5s, 2→3 delay ~30s
- [x] Manuscript end-to-end time (all chunks) < 5 minutes
- [x] Output JSON valid and schema-compliant

---

## Next Steps (Phase 2)

Once staging is stable:

1. **LLM Provider Factory** (strict interface)
2. **Phase 2 Finalize** (idempotent aggregation)
3. **Expand smoke runbook** to include Phase 2 tests
4. **Maintain discipline:** Never skip the runbook

---

**Questions?** See [PRODUCTION_SECRETS_DEPLOY.md](./PRODUCTION_SECRETS_DEPLOY.md)
