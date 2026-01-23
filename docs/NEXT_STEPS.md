# PATH FORWARD: Secrets → Staging → Production

**Completed:** 2026-01-22  
**Status:** ✅ Staging-Ready with Quality Gate  
**Next:** LLM Provider Factory + Phase 2 Finalize

---

## What You Have Now

### Foundation (Completed)
✅ Secrets properly segmented (anon vs service role)  
✅ Zero silent fallbacks (code warns + fails)  
✅ All migrations applied (9/9)  
✅ Atomic claiming RPC exists and works  
✅ Crash recovery enabled (15-min lease)  
✅ Manuscript chunking + Phase 1 ready  

### Deployment Infrastructure
✅ **Staging Smoke Runbook** (`scripts/staging-smoke-runbook.sh`)
- Pushes migrations
- Tests crash recovery
- Runs end-to-end processing
- Validates outputs
- Exit 0 = safe to promote

### Documentation
✅ [PRODUCTION_SECRETS_DEPLOY.md](./docs/PRODUCTION_SECRETS_DEPLOY.md) — Full secrets guide  
✅ [STAGING_DEPLOY_CHECKLIST.md](./docs/STAGING_DEPLOY_CHECKLIST.md) — Step-by-step  
✅ [DEPLOYMENT_READY.md](./docs/DEPLOYMENT_READY.md) — Phase 1 complete  

---

## ⛔ Critical: When NOT to Deploy

**VETO if ANY of these conditions exist:**

- ❌ Migrations fail locally
- ❌ Smoke runbook exits non-zero
- ❌ Supabase/Vercel status page red
- ❌ Haven't waited 24h for stability (staging gate)
- ❌ RLS errors in logs (`permission denied`)
- ❌ Function not found (`does not exist`)
- ❌ Service role key missing from Vercel
- ❌ You're unsure → stop and investigate

**Response:** Fix locally, verify with smoke runbook (exit 0), then retry deployment.

---

## Immediate Actions (Next 24h) — Total: ~15 min

### Staging Deploy
```bash
# 1. Set Vercel staging env vars (different project, different keys)
# Go to: Vercel Dashboard → Project Settings → Environment Variables
SUPABASE_SERVICE_ROLE_KEY=<staging-key>
NEXT_PUBLIC_SUPABASE_URL=<staging-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon>
NODE_ENV=production
USE_SUPABASE_JOBS=true

# 2. Push migrations (find Project ID at Supabase → Settings → General → Project reference)
supabase link --project-ref staging-project-id
supabase db push

# 3. Quality Gate: Only proceed if this exits 0
export SUPABASE_PROJECT_ID=staging-project-id
bash scripts/staging-smoke-runbook.sh staging
# Expected: ✓ ALL CHECKS PASSED

# 4. Deploy to preview (uses staging env vars)
vercel
```

### Monitor (First Hour)
- ❌ Stop if: `[RG-SUPABASE] Using ANON key` warning appears
- ❌ Stop if: `permission denied` RLS errors
- ✅ Watch: Chunks transition pending → processing → done

### Production Deploy (After 24h Staging Stability)
Same flow, but **different Supabase project + keys** and branch:
```bash
# 1. Checkout main branch (production)
git checkout main

# 2. Set Vercel production env vars (Vercel Dashboard → Production environment)
SUPABASE_SERVICE_ROLE_KEY=<prod-key>
NEXT_PUBLIC_SUPABASE_URL=<prod-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<prod-anon>

# 3. Same smoke runbook gate, but with prod project ID
export SUPABASE_PROJECT_ID=prod-project-id
bash scripts/staging-smoke-runbook.sh production
# Must exit 0 before proceeding

# 4. Deploy to production
vercel deploy --prod
```

---

## Key Files You Need

| File | When to Use |
|------|------------|
| `scripts/staging-smoke-runbook.sh` | Before ANY prod deploy |
| `docs/PRODUCTION_SECRETS_DEPLOY.md` | Setup staging/prod secrets |
| `docs/STAGING_DEPLOY_CHECKLIST.md` | Copy the checklist steps |
| `.env.local` | Local dev (already set up) |
| `lib/supabase.js` | Reference: how to use admin client |
| `lib/manuscripts/chunks.ts` | Reference: atomic claiming pattern |

---

## 📊 Branch Strategy (Critical for Multi-Env)

**Staging branch** (`staging`)
- Deploys to: Staging Supabase project  
- Vercel: Staging environment alias
- Use for: Testing migrations + features before production
- Merge from: develop/feature branches

**Main branch** (`main`)
- Deploys to: Production Supabase project  
- Vercel: Production environment  
- Use for: Stable, smoke-tested releases only
- Never merge to main without passing smoke runbook

**Local dev** (`.env.local`)
- Supabase: Local instance (never production keys)
- Use for: Development + local integration testing
- Keys: Non-production credentials only

This matches Supabase's multi-environment best practice: each environment has isolated Supabase project, credentials, and branch.

---

## 🛡️ Schema Changes: Migrations-First Workflow

**All schema modifications must follow this immutable path:**

```
1. Create migration locally
   $ supabase migration new add_new_table

2. Edit migration file in supabase/migrations/

3. Test locally
   $ supabase db push

4. Commit + push to staging branch
   $ git add supabase/migrations/
   $ git commit -m "Migration: add_new_table"
   $ git push origin staging

5. Run smoke runbook on staging
   $ export SUPABASE_PROJECT_ID=staging-id
   $ bash scripts/staging-smoke-runbook.sh staging

6. Monitor staging for 24h (confirms no RLS issues)

7. Create PR: staging → main

8. Run smoke runbook on production
   $ export SUPABASE_PROJECT_ID=prod-id
   $ bash scripts/staging-smoke-runbook.sh production

9. Merge to main + deploy
   $ vercel deploy --prod
```

**Why this matters:**
- Migrations are version-controlled + reproducible
- Smoke runbook catches missing RLS/function issues early
- Never touch schema via Supabase UI (not tracked)
- Rollback is just reverting the migration file

**Never:**
- ❌ Modify schema directly in Supabase UI
- ❌ Skip smoke runbook before prod
- ❌ Merge to main without 24h staging soak
- ❌ Use `ALTER TABLE` outside migrations

---

## Critical: What NOT to Skip

1. **NEVER deploy to production without running the smoke runbook**
   ```bash
   bash scripts/staging-smoke-runbook.sh production
   # Must exit 0 before promotion
   ```

2. **NEVER reuse Supabase project or keys across staging/prod**
   - Different projects = different credentials
   - Different credentials = no accidental cross-contamination

3. **NEVER push migrations without testing locally first**
   ```bash
   supabase db push  # Local first
   # Then promote via smoke runbook
   ```

---

## Phase 2: Safe to Build Now

Job engine is solid. Next layer:

### 1. LLM Provider Factory (Week 2)
- Abstract away specific model (Claude/GPT/etc)
- Deterministic fallbacks
- Retry policy with backoff
- Provider-agnostic schema

### 2. Phase 2 Finalize (Week 3)
- Idempotent aggregation
- All chunks done → call finalize RPC
- Validate output schema
- No partial states in production

### 3. Extend Smoke Runbook (Week 3)
- Add Phase 2 LLM tests
- Validate end-to-end latency
- Keep same discipline forever

---

## Success = Never Skipping the Runbook

The smoke runbook is how you maintain this quality bar for years:

```
┌─────────────────────────────┐
│  Feature complete locally   │
│  Ready for staging?         │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│ bash staging-smoke-runbook  │
│ (migrations + tests + e2e)  │
└──────────────┬──────────────┘
               │
         Exit 0? → YES
               │
               ↓
┌─────────────────────────────┐
│  Deploy to staging          │
│  Monitor 1 hour             │
│  Ready for prod?            │
└──────────────┬──────────────┘
               │
               ↓
┌─────────────────────────────┐
│ bash production-smoke-test  │
│ (same runbook, prod secrets)│
└──────────────┬──────────────┘
               │
         Exit 0? → YES
               │
               ↓
┌─────────────────────────────┐
│  Deploy to production       │
│  ✅ SAFE                    │
└─────────────────────────────┘
```

---

## One More Thing

You've now got:
- ✅ Secrets that don't silently fail
- ✅ Migrations that are tracked and testable
- ✅ A quality gate (smoke runbook) that proves things work
- ✅ Crash recovery that actually recovers
- ✅ Documentation that prevents tribal knowledge

That's not fragile plumbing anymore.

**That's a platform.**

🚀
