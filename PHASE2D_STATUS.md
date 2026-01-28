# Phase 2D Evidence Gate: Current Status & Action Required

**Date:** 2026-01-28  
**Completed By:** Automated diagnosis + Perplexity + CI debugging  
**Status:** 🟡 **IN PROGRESS** - Migrations partially applied, final steps pending

---

## ✅ Completed

### 1. Secrets Infrastructure Fixed
- ✅ **SUPABASE_URL** - Present in GitHub Actions
- ✅ **SUPABASE_SERVICE_ROLE_KEY** - Present in GitHub Actions
- ✅ **SUPABASE_ANON_KEY** - Present in GitHub Actions (was missing, now fixed)
- ✅ **NEXT_PUBLIC_SUPABASE_URL** - Now added to GitHub Actions (was missing)
- ✅ **NEXT_PUBLIC_SUPABASE_ANON_KEY** - Now added to GitHub Actions (was missing)

**Evidence:** Workflow run 21459358407 confirmed all critical secrets flowing.

### 2. Code Fallbacks Fixed
- ✅ **workers/claimJob.ts** - Added fallback: `process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL`
- ✅ **lib/supabase.js** - Already had fallback logic

**Evidence:** Run 21459358407 got past environment check into database phase.

### 3. Phase 2D Migration 1 Applied
- ✅ **20260128000001_add_eval_job_lease_fields.sql** - Applied to Supabase production
  - Added columns: `worker_id`, `lease_until`, `lease_token`, `heartbeat_at`, `started_at`
  - Added indexes: `idx_evaluation_jobs_status_lease`, `idx_evaluation_jobs_worker_id`

**Evidence:** Perplexity confirmed successful application.

---

## 🟡 Pending: Phase 2D Migrations 2-6

**Why:** These create the RPCs, tables, and constraints needed for atomic claiming, idempotency, and lease renewal.

| Migration | Purpose | Status |
|-----------|---------|--------|
| 20260128000002 | Fix `claim_job_atomic` RPC | ⏳ Pending |
| 20260128000003 | Create `evaluation_provider_calls` table | ⏳ Pending |
| 20260128000004 | Add idempotency constraint | ⏳ Pending |
| 20260128000005 | Grant RPC execute permissions | ⏳ Pending |
| 20260128000006 | Create `renew_lease` RPC | ⏳ Pending |

### Current Blocker in `supabase db push`

Earlier migrations (20260124000000_evaluation_artifacts.sql) have schema drift that blocks the full push. Rather than unblock, the fastest path is to apply Migrations 2-6 directly.

---

## 🎯 Next Steps (User Action)

### Step 1: Apply Phase 2D Migrations 2-6

**Option A: Supabase Dashboard** (Recommended - 5 minutes)
1. Go to https://app.supabase.com/projects
2. Select **RevisionGrade Production** (xtumxjnzdswuumndcbwc)
3. **SQL Editor** → **New Query**
4. Copy SQL from `/tmp/phase2d-2-6.sql`
5. Paste and **Run**

**Option B: Read the instructions**
See [APPLY_PHASE2D_2-6.md](APPLY_PHASE2D_2-6.md) for detailed step-by-step guide and verification queries.

### Step 2: Trigger Phase 2D Evidence Gate Workflow

```bash
# After migrations applied, push to trigger workflow
git commit --allow-empty -m "trigger: Phase 2D Evidence Gate workflow with all migrations applied"
git push origin main

# Monitor
gh run list --workflow=phase2d-evidence.yml --limit=1
```

### Step 3: Expected Results

Once migrations are applied, the workflow will:

**Best Case** ✅
```
Phase 2D-1 Atomic claim concurrency: ✅ PASS
Phase 2D-2 Idempotency proof: ✅ PASS  
Phase 2D-3 Reconciler + heartbeat: ✅ PASS
→ Phase 2D Evidence: LOCKED
```

**Likely Case** ❌ (but actionable)
```
Phase 2D-1 Atomic claim concurrency: ✅ PASS
Phase 2D-2 Idempotency proof: ✅ PASS
Phase 2D-3 Reconciler + heartbeat: ❌ FAIL (specific assertion)
→ Reveals what logic needs fixing
```

Either way, you'll know the schema is correct and can fix any remaining code issues.

---

## 📊 Timeline

| Time | Event |
|------|-------|
| Earlier | Phase 2D code implemented, migrations created |
| Run #21458961679 (23:09) | SUPABASE_ANON_KEY empty → Failed |
| Run #21459298598 (23:23) | workers/claimJob.ts no fallback → Failed |
| Run #21459358407 (23:26) | DB schema incomplete (no lease_until) → Failed with Postgres 42703 |
| Now | Migration 1 applied, Migrations 2-6 ready |
| Next | User applies Migrations 2-6 |
| Final | Workflow runs and locks Phase 2D or reveals code bugs |

---

## 📋 Checklist for You

- [ ] Read [APPLY_PHASE2D_2-6.md](APPLY_PHASE2D_2-6.md) for detailed instructions
- [ ] Apply Migrations 2-6 via Supabase Dashboard (Option A) or CLI (Option B)
- [ ] Run verification queries to confirm schema is complete
- [ ] Push a commit to trigger Phase 2D Evidence Gate workflow
- [ ] Monitor the workflow run and check results

---

## 🔍 Summary

**What was wrong:**
1. Secrets weren't flowing → **FIXED**
2. Code had no fallback → **FIXED**
3. Database schema was incomplete → **PARTIALLY FIXED** (M1 applied, M2-6 pending)

**What's left:**
- Apply remaining 5 migrations to Supabase
- Trigger workflow to verify

**Expected outcome:**
- Phase 2D Evidence Gate passes and locks, OR
- Reveals specific code-level failures that need fixing

**Effort required:**
~5-10 minutes to apply migrations + ~3 minutes to verify workflow results.

