# 🚀 Quick Deployment Reference Card

**Production-deployment-ready staging & prod setup. All 6 Perplexity recommendations implemented.**

---

## ⛔ STOP: Veto Conditions

**DO NOT DEPLOY if any of these are true:**

- ❌ Migrations fail locally
- ❌ Smoke runbook exits non-zero
- ❌ Supabase/Vercel status page red
- ❌ RLS or "function not found" errors
- ❌ Haven't waited 24h for stability
- ❌ Service role key missing from Vercel
- ❌ **Linked to WRONG Supabase project** (verify with `supabase status`)
- ❌ You're not sure

**Critical check before `supabase db push`:**
```bash
supabase status  # MUST show staging project, not production!
# If wrong project shown: STOP and verify linked project
```

**Action:** Fix locally, verify with smoke runbook (exit 0), then retry.

---

## Deploy to Staging (~15 min)

```bash
# 1. Set Vercel staging env (Project Settings → Environment Variables)
# Select "Staging" environment
# IMPORTANT: Never paste real keys—copy these FROM Supabase, not into docs
SUPABASE_SERVICE_ROLE_KEY=<get-from-supabase-dashboard>
NEXT_PUBLIC_SUPABASE_URL=<get-from-supabase-dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<get-from-supabase-dashboard>
NODE_ENV=production
USE_SUPABASE_JOBS=true

# 2. Find Project ID
# Supabase Dashboard → Select project → Settings → General → Project reference

# 3. VERIFY linked project (CRITICAL SAFETY CHECK)
supabase link --project-ref <staging-project-id>
supabase status    # STOP if this shows production project, not staging!

# 4. Push migrations (only if supabase status confirmed staging)
supabase db push

# 5. Run quality gate (must exit 0)
export SUPABASE_PROJECT_ID=<staging-project-id>
bash scripts/staging-smoke-runbook.sh staging

# 6. Deploy to preview (uses staging env vars)
vercel    # No flags = preview deployment (NOT --staging, that doesn't exist)

# 7. Monitor first hour
# Watch for: [RG-SUPABASE] Using ANON key / permission denied
# Wait 24h (see stability metrics below)
```

---

## Deploy to Production (~20 min, after 24h staging stability)

```bash
# 1. Checkout main + set Vercel prod env
git checkout main
git pull origin main
# Select "Production" environment in Vercel
SUPABASE_SERVICE_ROLE_KEY=<prod-key>
NEXT_PUBLIC_SUPABASE_URL=<prod-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon>
NODE_ENV=production
USE_SUPABASE_JOBS=true

# 2. Push migrations to prod Supabase
supabase link --project-ref <prod-project-id>
supabase db push

# 3. Run quality gate on prod (must exit 0)
export SUPABASE_PROJECT_ID=<prod-project-id>
bash scripts/staging-smoke-runbook.sh production

# 4. Deploy to production
vercel deploy --prod

# 5. Monitor first hour
```

---

## Schema Changes (Any Time)

```bash
# 1. Create migration
supabase migration new descriptive_name

# 2. Edit supabase/migrations/
# 3. Test locally
supabase db push

# 4. Commit + push to staging
git add supabase/migrations/
git commit -m "Migration: descriptive_name"
git push origin staging

# 5. Push to staging Supabase
supabase link --project-ref <staging-id>
supabase db push

# 6. Run smoke runbook on staging
bash scripts/staging-smoke-runbook.sh staging

# 7. Wait 24h, monitor staging

# 8. Create PR (staging → main)

# 9. Run smoke runbook on prod
bash scripts/staging-smoke-runbook.sh production

# 10. Merge + deploy
git checkout main
git merge staging
vercel deploy --prod
```

---

## Branch Strategy

```
staging branch    → staging Supabase project  → vercel (preview)
main branch       → prod Supabase project     → vercel deploy --prod
.env.local        → local Supabase (never prod keys)
```

---

## Critical Rules

❌ **Never:**
- Deploy to production without smoke runbook exit 0
- Reuse Supabase projects/keys across staging/prod
- Modify schema in Supabase UI (use migrations only)
- Skip smoke runbook before production
- Merge to main without 24h staging soak

✅ **Always:**
- Use service role key for all server writes
- Push migrations locally first, then staging, then prod
- Run smoke runbook on every environment before deploy
- Wait 24h between staging → production

---

## Find Project Reference

1. [Supabase Dashboard](https://app.supabase.com)
2. Select project
3. Settings → General
4. Copy "Project reference" (e.g., `abcdefghijklmnop`)

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `permission denied` RLS | SUPABASE_SERVICE_ROLE_KEY not in Vercel |
| `function does not exist` | Migrations didn't push to Supabase |
| Stuck chunks | Workers may have crashed; check heartbeat |

See: [docs/PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md)

---

## Time Budget

| Task | Time |
|------|------|
| Set Vercel env | 5 min |
| Push migrations | 2 min |
| Run smoke runbook | 30 sec |
| Deploy | 5 min |
| **Staging total** | **~15 min** |
| + Monitor 24h | _ongoing_ |
| **Production total** | **~20 min** |

---

## Smoke Runbook Result

```
✓ Migrations applied successfully
✓ Crash recovery test passed
✓ End-to-end processing completed
✓ Outputs validated
ALL CHECKS PASSED
```

Exit code: `0` (locked to quality baseline)

---

## Key Files

- [STAGING_READY.md](STAGING_READY.md) — Start here
- [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) — Step-by-step
- [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) — Immediate actions
- [docs/PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md) — Complete reference

---

**Status:** ✅ Production-ready  
**2am-ready:** Follow blind, no context-switches  
**Quality gate:** Smoke runbook (exit 0 = safe)

🚀
