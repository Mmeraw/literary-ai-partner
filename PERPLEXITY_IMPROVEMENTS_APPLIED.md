# Perplexity Feedback: Improvements Applied ✅

**Date:** 2026-01-23  
**Status:** All recommendations implemented  
**Impact:** Deployment docs now 2am-ready (blind follow-able)

---

## Summary of Changes

Perplexity reviewed the staging deployment plan and identified 6 areas for improvement. All have been implemented across three key documentation files.

---

## 1. ✅ Clarify Deploy Type (Vercel Environment Distinction)

### Problem
Original doc: Suggested `vercel deploy --staging` (doesn't exist)  
Confusion: Staging/production distinction unclear; --staging flag not real

### Solution Implemented

**STAGING_READY.md - Step 4:**
```bash
# Old: vercel deploy --staging
# New: vercel (preview) or vercel --prod (production)
```

**Added clarification:**
> `vercel` (no flags) creates a preview deployment using staging Supabase env vars. Production uses `vercel --prod` with production Supabase credentials.

**Files Updated:**
- [STAGING_READY.md](STAGING_READY.md#-get-to-staging-total-15-minutes) — Line ~53
- [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) — Production deploy section
- [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) — Step 4

---

## 2. ✅ Make IDs Concrete (Supabase Project Reference Discovery)

### Problem
Original: "your-staging-project-id" (requires context-switch to Supabase UI to recall format)

### Solution Implemented

**Added 4-step discovery instructions:**

```
Where to find Project ID:
1. Open Supabase Dashboard (https://app.supabase.com)
2. Select your staging project
3. Go to Settings → General
4. Copy Project reference (e.g., abcdefghijklmnop)
```

**Files Updated:**
- [STAGING_READY.md](STAGING_READY.md#-get-to-staging-total-15-minutes) — Step 2
- [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) — All project ID references

---

## 3. ✅ Call Out Branch Strategy (Multi-Env Clarity)

### Problem
No explicit mapping: which branch → which environment

### Solution Implemented

**NEW SECTION: Branch Strategy**

```
Staging branch (staging)
  → Staging Supabase project
  → Vercel staging environment

Main branch (main)
  → Production Supabase project
  → Vercel production environment

Local dev (.env.local)
  → Local Supabase (never prod keys)
```

**Added note:** "This matches Supabase's multi-environment best practice"

**Files Updated:**
- [STAGING_READY.md](STAGING_READY.md#-branch-strategy) — NEW SECTION
- [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md#-branch-strategy-critical-for-multi-env) — NEW SECTION

---

## 4. ✅ Add Expected Duration (Time Budget per Step)

### Problem
Original: No time estimates (can't budget attention)

### Solution Implemented

**Added step-by-step timing:**

```
Staging Deployment (Total: ~15 minutes)
  1. Set Vercel env vars — 5 min
  2. Push migrations — 2 min
  3. Run quality gate — 30 sec
  4. Deploy to staging — 5 min
  5. Monitor first hour — ongoing

Production Deployment (~20 min total, after 24h staging stability)
  1. Checkout main & set env — 5 min
  2. Push migrations — 2 min
  3. Final validation — 30 sec
  4. Deploy to prod — 5 min
  5. Monitor first hour — ongoing
```

**Files Updated:**
- [STAGING_READY.md](STAGING_READY.md#-get-to-staging-total-15-minutes) — Step headers
- [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) — Checklist headers + pre-Deploy note

---

## 5. ✅ Link Smoke Runbook Results to Quality Baseline

### Problem
Smoke runbook output "ALL CHECKS PASSED" has no context (what commit is this baseline?)

### Solution Implemented

**Updated baseline messaging:**

```bash
# Old: Exit code 0 ✅
# New: Exit code 0 ✅ (locked to quality baseline)
```

**Added context:** The runbook must always stay green on `infra-hygiene` baseline (enforces immutable quality contract)

**Files Updated:**
- [STAGING_READY.md](STAGING_READY.md#-run-quality-gate--30-sec) — Step 3
- [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) — Step 3

---

## 6. ✅ Include Schema Change Enforcement (Migrations-First Workflow)

### Problem
No explicit guidance: how do I modify schema safely? (can lead to UI-only changes, untracked)

### Solution Implemented

**NEW SECTION: Schema Changes & Migrations**

```
All schema changes must follow this immutable path:

1. Create migration locally
   supabase migration new add_new_table

2. Edit migration file in supabase/migrations/

3. Test locally
   supabase db push

4. Commit + push to staging branch
   git add supabase/migrations/
   git commit -m "Migration: add_new_table"

5. Run smoke runbook on staging
   bash scripts/staging-smoke-runbook.sh staging

6. Monitor staging 24h

7. Create PR: staging → main

8. Run smoke runbook on production
   bash scripts/staging-smoke-runbook.sh production

9. Merge to main + deploy
```

**Explicit Do-Not-Do List:**
- ❌ Modify schema directly in Supabase UI (not tracked)
- ❌ Skip smoke runbook before prod
- ❌ Merge to main without 24h staging soak
- ❌ Use ALTER TABLE outside migrations

**Files Updated:**
- [STAGING_READY.md](STAGING_READY.md#-schema-change-enforcement) — NEW SECTION
- [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md#-schema-changes-migrations-first-workflow) — NEW SECTION
- [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations) — NEW SECTION

---

## Impact Assessment

### Before
- ❌ Deployment guide required tribal knowledge (2-3 context switches)
- ❌ Staging/prod distinction unclear (mental model confusion)
- ❌ Schema changes had no enforced process (risk of untracked UI modifications)
- ❌ No time budget (couldn't plan around deploy window)
- ❌ Smoke runbook quality baseline not linked to code

### After
- ✅ 2am-ready: follow doc blind, no context-switches
- ✅ Branch strategy explicit (staging ≠ main ≠ local)
- ✅ All schema changes flow through migrations + smoke test
- ✅ Each step has time estimate (plan attention accordingly)
- ✅ Quality baseline locked to `infra-hygiene` (immutable contract)

---

## Files Modified

| File | Changes | Impact |
|------|---------|--------|
| [STAGING_READY.md](STAGING_READY.md) | +2 sections (branch strategy, schema enforcement) + 4 timing headers + concrete ID guidance | Main deployment guide now production-ready |
| [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md) | +2 sections (branch strategy, schema workflow) + detailed step timings + branch context in deploy commands | Immediate actions now explicit + traceable |
| [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md) | +1 section (schema changes) + timing headers + Vercel env UI instructions + 24h pre-req gate | Checklist now step-by-step idiot-proof |

---

## Recommendations Honored

✅ **Perplexity's strong points preserved:**
- Separation of staging vs prod (now even clearer)
- Smoke runbook as quality gate (now linked to baseline)
- Rollback thinking (unchanged)
- Production-first discipline (now enforced at schema level)

✅ **All minor tweaks implemented**

---

## Next Action

You can now use these docs as your deployment playbook:

1. **Staging Deploy:** Follow [STAGING_READY.md](STAGING_READY.md) + [docs/STAGING_DEPLOY_CHECKLIST.md](docs/STAGING_DEPLOY_CHECKLIST.md)
2. **Immediate Actions:** See [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
3. **Schema Changes:** All paths go through [docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations](docs/STAGING_DEPLOY_CHECKLIST.md#-schema-changes--migrations)

**Quality guarantee:** All processes lock to smoke runbook. No deploy without exit code `0`.

---

**Updated:** 2026-01-23  
**Status:** Production-deployment docs now 2am-ready ✅  
**Next:** Execute staging deploy following updated checklist
