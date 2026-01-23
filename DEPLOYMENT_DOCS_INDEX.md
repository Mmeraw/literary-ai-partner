# 📚 Deployment Documentation Index

**Status:** ✅ Production-Ready (All Perplexity recommendations implemented)  
**Last Updated:** 2026-01-23  

---

## 🎯 Quick Start

### New Here?
→ **Start:** [STAGING_READY.md](STAGING_READY.md)  
→ **Then:** [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md)  
→ **Time:** ~25 minutes to understand

### Need to Deploy Now?
→ **Checklist:** [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md)  
→ **Quick Ref:** [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md)  
→ **Time:** ~15 minutes execution

### Want to Understand Changes?
→ **What Changed:** [PERPLEXITY_IMPROVEMENTS_APPLIED.md](PERPLEXITY_IMPROVEMENTS_APPLIED.md)  
→ **Why Changed:** [DOCS_IMPROVEMENTS_SUMMARY.md](DOCS_IMPROVEMENTS_SUMMARY.md)  
→ **Verification:** [IMPLEMENTATION_VERIFICATION.md](IMPLEMENTATION_VERIFICATION.md)  
→ **Time:** ~10 minutes review

---

## 📋 Documentation Map

### Core Deployment Docs (Read These First)

| Document | Purpose | Read Time | Action |
|----------|---------|-----------|--------|
| [STAGING_READY.md](STAGING_READY.md) | Overview + 4-step staging guide | 5 min | ⭐ **START HERE** |
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | Immediate actions + branch strategy | 10 min | Understand workflow |
| [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) | Step-by-step execution guide (staging & prod) | 15 min | **FOLLOW DURING DEPLOY** |

### Implementation Guides (Reference As Needed)

| Document | Purpose | When to Use |
|----------|---------|------------|
| [docs/PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md) | Complete secrets + troubleshooting | Deep dive, debugging |
| [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md) | One-page cheat sheet | During deployment (copy-paste) |

### Change Documentation (Review if You're New to These Improvements)

| Document | Purpose | Read Time |
|----------|---------|-----------|
| [PERPLEXITY_IMPROVEMENTS_APPLIED.md](PERPLEXITY_IMPROVEMENTS_APPLIED.md) | Complete changelog of all 6 improvements | 5 min |
| [DOCS_IMPROVEMENTS_SUMMARY.md](DOCS_IMPROVEMENTS_SUMMARY.md) | Before/after comparison with examples | 5 min |
| [IMPLEMENTATION_VERIFICATION.md](IMPLEMENTATION_VERIFICATION.md) | Checklist-style verification of implementation | 5 min |
| [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md) | Executive summary + next actions | 3 min |

### Quick References

| Document | Use For |
|----------|---------|
| [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md) | Copy-paste commands during deploy |
| [RUNBOOK_COMMANDS.sh](RUNBOOK_COMMANDS.sh) | Pre-built shell commands |
| [scripts/staging-smoke-runbook.sh](scripts/staging-smoke-runbook.sh) | Quality gate (must exit 0) |

---

## 🚀 Deployment Workflows

### Staging Deployment (~15 minutes)

```
1. Read: STAGING_READY.md (Step 1-4)
2. Follow: docs/STAGING_DEPLOY_CHECKLIST.md (Staging section)
3. Reference: DEPLOYMENT_QUICK_REFERENCE.md
4. Verify: Smoke runbook exits 0
5. Monitor: First hour in Vercel logs
6. Wait: 24 hours for stability
```

### Production Deployment (~20 minutes, after 24h staging)

```
1. Verify: Staging has been stable 24h
2. Follow: docs/STAGING_DEPLOY_CHECKLIST.md (Production section)
3. Reference: DEPLOYMENT_QUICK_REFERENCE.md
4. Verify: Smoke runbook exits 0 on prod
5. Deploy: vercel deploy --prod
6. Monitor: First hour in Vercel logs
```

### Schema Changes (Any Time)

```
1. Create: supabase migration new <name>
2. Test: supabase db push (locally)
3. Commit: git add + push to staging branch
4. Gate: bash scripts/staging-smoke-runbook.sh staging
5. Wait: 24h for staging stability
6. Promote: Create PR staging → main
7. Gate: bash scripts/staging-smoke-runbook.sh production
8. Deploy: Merge + vercel deploy --prod
```

Reference: [docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations](docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations)

---

## 📊 6 Key Improvements (All Implemented ✅)

### 1. ✅ Deploy Type Clarity
`vercel` for preview deployment (staging Supabase env vars)  
→ Prevents mental confusion between environments

### 2. ✅ Concrete Project IDs
"Find at Supabase Dashboard → Settings → General → Project reference"  
→ No context-switching to figure out the format

### 3. ✅ Branch Strategy
```
staging branch → staging Supabase
main branch    → production Supabase
.env.local     → local dev (never prod keys)
```
→ Clear multi-environment mapping

### 4. ✅ Time Budget
Staging: ~15 min | Production: ~20 min (each step timed)  
→ Can plan deployment window

### 5. ✅ Quality Baseline
"Exit 0 (locked to quality baseline)"  
→ Smoke runbook is immutable contract

### 6. ✅ Migrations-First Workflow
All schema changes: local → staging (24h) → prod  
→ Never modify schema in UI (must track in git)

---

## 🎓 Key Concepts

### Branch Strategy
- `staging` branch deploys to staging Supabase (via `vercel` for preview)
- `main` branch deploys to production Supabase (via `vercel deploy --prod`)
- `.env.local` is for local dev only (never production keys)

### Quality Gates
- **Always required:** Smoke runbook must exit 0 before any deploy
- **Immutable:** Quality baseline locked to `infra-hygiene`
- **Enforced:** No manual RLS/function modifications allowed

### Schema Changes
- **Only via migrations:** `supabase migration new`
- **Always tested:** Must pass smoke runbook on staging
- **Always staged:** 24-hour soak period before prod promotion
- **Never UI-only:** All changes tracked in git via migration files

### Deployment Safety
- **Staging before production:** Never skip staging → production → deploy workflow
- **Smoke runbook gates:** Each environment has its own smoke test run
- **24-hour stability gate:** Wait before promoting staging → production

---

## 🔍 Finding Specific Information

### "How do I deploy to staging?"
→ [STAGING_READY.md](STAGING_READY.md) (5 min read)  
→ [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) (follow during deploy)

### "How do I deploy to production?"
→ [docs/STAGING_DEPLOY_CHECKLIST.md#production-deployment](docs/STAGING_DEPLOY_CHECKLIST.md#production-deployment-20-min-total) (follow checklist)

### "How do I add a new table?"
→ [docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations](docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations)

### "Where do I find the project ID?"
→ [STAGING_READY.md#-push-migrations--2-min](STAGING_READY.md#-push-migrations--2-min) (4-step discovery)

### "What if something breaks?"
→ [docs/STAGING_DEPLOY_CHECKLIST.md#rollback-plan](docs/STAGING_DEPLOY_CHECKLIST.md#rollback-plan) (troubleshooting)

### "What changed in the docs?"
→ [PERPLEXITY_IMPROVEMENTS_APPLIED.md](PERPLEXITY_IMPROVEMENTS_APPLIED.md) (complete changelog)

### "Quick command reference?"
→ [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md) (one-page cheat sheet)

---

## ✅ Pre-Deployment Checklist

- [ ] Read [STAGING_READY.md](STAGING_READY.md)
- [ ] Review [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md)
- [ ] Understand branch strategy (staging vs main)
- [ ] Know where to find Project ID (Supabase Settings → General)
- [ ] Have staging Supabase credentials ready
- [ ] Have Vercel access (can set environment variables)
- [ ] Know smoke runbook location (scripts/staging-smoke-runbook.sh)
- [ ] Ready to wait 24h between staging → production

---

## 🚀 Quick Links

| Task | Document | Command |
|------|----------|---------|
| Deploy staging | [STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) | `vercel` (preview) |
| Deploy production | [STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) | `vercel deploy --prod` |
| Run quality gate | [scripts/staging-smoke-runbook.sh](scripts/staging-smoke-runbook.sh) | `bash scripts/staging-smoke-runbook.sh staging` |
| Add schema | [STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations) | `supabase migration new` |
| Quick reference | [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md) | _One-page cheat sheet_ |

---

## 📞 Support & Troubleshooting

### Common Issues

| Issue | Solution | Doc |
|-------|----------|-----|
| RLS permission denied | SUPABASE_SERVICE_ROLE_KEY missing in Vercel | [PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md) |
| Function not found | Migrations didn't push to Supabase | [STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md#2-push-migrations) |
| Stuck chunks | Workers crashed; check heartbeat | [PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md) |
| Don't know project ID | Supabase Settings → General → Project reference | [STAGING_READY.md](STAGING_READY.md#-push-migrations--2-min) |

### Getting Help

1. **First:** Check [STAGING_DEPLOY_CHECKLIST.md#rollback-plan](docs/STAGING_DEPLOY_CHECKLIST.md#rollback-plan)
2. **Then:** Check [docs/PRODUCTION_SECRETS_DEPLOY.md](docs/PRODUCTION_SECRETS_DEPLOY.md)
3. **Then:** Check [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
4. **Finally:** Check logs in Vercel dashboard or Supabase studio

---

## 📈 Status

✅ **Perplexity Recommendations:** All 6 implemented  
✅ **Documentation:** Production-grade  
✅ **Smoke Runbook:** Quality gate locked  
✅ **Branch Strategy:** Explicit  
✅ **Migrations:** Enforced  
✅ **Timing:** Per-step + total  

---

## 🎯 Your Next Step

**Pick one:**

1. **Deploy Staging Now?** → [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md)
2. **Understand First?** → [STAGING_READY.md](STAGING_READY.md)
3. **Quick Commands?** → [DEPLOYMENT_QUICK_REFERENCE.md](DEPLOYMENT_QUICK_REFERENCE.md)
4. **See What Changed?** → [PERPLEXITY_IMPROVEMENTS_APPLIED.md](PERPLEXITY_IMPROVEMENTS_APPLIED.md)

---

**Documentation Status:** ✅ Ready  
**Quality Gate:** Smoke runbook (exit 0 = safe)  
**Next:** Execute staging deployment 🚀

---

*Last Updated: 2026-01-23*  
*All Perplexity Recommendations: Implemented ✅*
