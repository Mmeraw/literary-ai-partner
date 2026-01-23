# Complete Deployment Setup: Ready for Staging

**Status:** ✅ **READY TO DEPLOY**  
**Date:** 2026-01-22  
**Quality Gate:** Staging smoke runbook passes locally  

---

## 🎯 What You Have

| Component | Status | File |
|-----------|--------|------|
| Secrets configured (no anon fallback) | ✅ | `.env.local` |
| Migrations applied (9/9) | ✅ | `supabase/migrations/` |
| RPC for atomic claiming | ✅ | `20260122000001_*.sql` |
| Crash recovery enabled | ✅ | `20260122051139_*.sql` |
| Staging smoke runbook | ✅ | `scripts/staging-smoke-runbook.sh` |
| Complete documentation | ✅ | `docs/PRODUCTION_SECRETS_DEPLOY.md` |
| Quick reference | ✅ | `RUNBOOK_COMMANDS.sh` |

---

## 🚀 Get to Staging (Total: ~15 minutes)

### 1️⃣  Set Vercel Env Vars (Staging Project) — 5 min

Go to: **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

Add these 3 variables (values from your staging Supabase project):

```
SUPABASE_SERVICE_ROLE_KEY = eyJh...  (staging key - get from Supabase)
NEXT_PUBLIC_SUPABASE_URL = https://your-staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJh...  (staging anon key)
NODE_ENV = production
USE_SUPABASE_JOBS = true
```

### 2️⃣  Push Migrations — 2 min

```bash
# Find your-staging-project-id: Supabase Dashboard → Project Settings → General → Project reference
supabase link --project-ref your-staging-project-id
supabase db push
```

**Where to find Project ID:**
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your staging project
3. Go to **Settings** → **General**
4. Copy **Project reference** (e.g., `abcdefghijklmnop`)

### 3️⃣  Run Quality Gate — 30 sec

```bash
export SUPABASE_PROJECT_ID=your-staging-project-id
bash scripts/staging-smoke-runbook.sh staging
```

**Expect:**
```
✓ Migrations applied successfully
✓ Crash recovery test passed
✓ End-to-end processing completed
✓ Outputs validated
ALL CHECKS PASSED
```
Exit code `0` ✅ (locked to quality baseline)

### 4️⃣  Deploy to Vercel Staging — 1 min

```bash
# Create preview deployment to staging Supabase project
# Vercel will use STAGING environment variables set in project settings
vercel
```

**Important:** `vercel` (no flags) creates a preview deployment using your staging environment variables.  
After 24h stability, production uses `vercel --prod` with production Supabase credentials.

**Caution:** `--staging` flag does NOT exist in Vercel CLI. Use `vercel` for preview, `vercel --prod` for production.

---

## 🔐 Critical Security Rule: Never Paste Real Keys

**INVARIANT:** Never paste real credentials into:
- ❌ Markdown files
- ❌ Issues or PRs
- ❌ Slack messages
- ❌ Screenshots
- ❌ Terminal history
- ❌ Git repos

**How to get keys:**
1. Go to Supabase Dashboard (NOT docs)
2. Copy from **Settings → API** directly into Vercel
3. Never show in text, docs, or terminal output

**What you might see in docs:** `SUPABASE_SERVICE_ROLE_KEY=<staging-key>` (placeholder, not real)

This prevents accidental secret leaks and keeps your infrastructure safe.

---

## ⛔ When NOT to Deploy (Veto Conditions)

**STOP before deploying if ANY of these are true:**

- ❌ Migrations fail locally (`supabase db push` errors)
- ❌ Smoke runbook exits non-zero (need exit code `0`)
- ❌ Supabase or Vercel have status page incidents
- ❌ You haven't waited 24h since last staging deploy
- ❌ RLS or "function not found" errors in logs
- ❌ Service role key is missing from Vercel
- ❌ **You're linked to the WRONG Supabase project** (e.g., production instead of staging)
- ❌ You're not 100% sure → investigate first

**How to verify linked project:**
```bash
supabase status  # Must show: staging project, not production
# If wrong: STOP immediately before running `supabase db push`
```

**Default action:** Fix locally, re-test with smoke runbook, then retry.

## 📋 Complete Documentation Map

**Getting Started:**
- Start here → [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) (5 min read)

**Deployment Checklist:**
- Staging/prod → [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) (step-by-step)

**Complete Reference:**
- Secrets + troubleshooting → [docs/PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md) (comprehensive)

**Quick Commands:**
- Copy-paste → [RUNBOOK_COMMANDS.sh](RUNBOOK_COMMANDS.sh) (just the commands)

---

## � Branch Strategy

**Staging** deploys from `staging` branch → staging Supabase project  
**Production** deploys from `main` branch → production Supabase project  
**Local** dev uses `.env.local` → local Supabase (never production keys)

This matches Supabase's recommended multi-environment approach: dev → staging → prod each with isolated Supabase projects and credentials.

---

## �🔑 Key Architecture Decisions (Enforced by Code)

### No Silent Anon Fallback
```javascript
// lib/supabase.js
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("[RG-SUPABASE] Using ANON key - RLS will block writes");
}
```
Result: Visible failure if service role key missing

### All Writes Use Admin + RPC
```typescript
// lib/manuscripts/chunks.ts
const supabase = getSupabaseAdminClient();  // Enforced at module level
const { data } = await supabase.rpc("claim_chunk_for_processing", { chunk_id });
```
Result: Atomic, race-safe, production-ready claiming

### Crash Recovery Built-in
```sql
-- Chunks stuck for >15 minutes are recoverable
SELECT claim_chunk_for_processing(stuck_chunk_id);
-- This atomically updates status + increments attempt_count
```
Result: Worker crashes don't break the pipeline

---

## 🛡️ Schema Change Enforcement

**All schema changes must follow this path:**
```
Local migration (supabase migration new) 
  ↓ 
Test locally (supabase db push) 
  ↓ 
Push to staging (supabase db push --linked-project staging-id) 
  ↓ 
Run smoke runbook (bash scripts/staging-smoke-runbook.sh staging) 
  ↓ 
Promote to production (same flow with prod-id)
```

**Never modify schema directly in UI or skip migrations.** This is enforced by your smoke runbook—it will catch missing migrations.

---

## ⚠️  Critical Path Forward

1. **Do NOT skip the smoke runbook** — it's your safety net for years
2. **Use different Supabase projects** — staging ≠ production  
3. **Set SUPABASE_SERVICE_ROLE_KEY** — in Vercel secrets, not code
4. **Run migrations before deploy** — RPC needs to exist before workers start
5. **All schema changes via migrations** — local → staging → prod only
6. **Monitor first hour** — watch for RLS errors (means key is wrong)

---

## 🎓 What's Next (After Staging is Stable)

Phase 2: **LLM Provider Factory + Finalize Aggregation**

```
Week 1: LLM Factory
  • Strict interface + fallbacks
  • Provider-agnostic

Week 2: Phase 2 Finalize
  • Idempotent aggregation
  • Schema validation

Week 3: Extend Runbook
  • Add Phase 2 tests
  • Keep discipline forever
```

---

## 📞 Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| RLS errors in logs | [PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md#issue-writes-blocked-with-rls-error) |
| Function not found | [PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md#issue-claim-fails-with-function-does-not-exist) |
| Stuck chunks not recovering | [PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md#issue-stuck-chunks-not-being-recovered) |
| General secrets setup | [PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md#secrets-configuration) |

---

## ✅ Checklist Before Staging Deploy

- [ ] Read [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
- [ ] Set Vercel staging env vars (3 vars)
- [ ] Run `supabase db push`
- [ ] Run `bash scripts/staging-smoke-runbook.sh staging`
- [ ] Exit code is 0 (green light)
- [ ] Deploy to Vercel
- [ ] Monitor first hour in Vercel logs
- [ ] No `[RG-SUPABASE] Using ANON key` warnings
- [ ] No `permission denied` RLS errors
- [ ] After 24h stability → proceed to production with same runbook

---

## 🏁 Bottom Line

**Your job engine is solid. Smoke runbook is your quality gate. Never skip it.**

Now go build Phase 2 knowing the foundation won't break.

🚀

---

**Last Updated:** 2026-01-22  
**Status:** Production-ready infrastructure  
**Next Move:** Follow [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
