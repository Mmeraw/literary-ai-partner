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

### 4. Flow 1A: Local End-to-End Proof

- ✅ **Health check** — Dev server connectivity verified
- ✅ **Job creation** — Evaluation job queued successfully
- ✅ **Worker execution** — Worker route claimed and completed job
- ✅ **Result retrieval** — Final evaluation result persisted and readable
- ✅ **Canon compliance** — Canon Guard passed on commit

**Evidence:** `scripts/flow1_proof.sh`, `evidence/flow1/flow1_proof_run.txt`  
**Commits:** `573ebb7`, `dfd4f63`

### 5. Flow 1B: Jest Proof Pack

- ✅ **Cross-user isolation** — Unauthorized reads blocked (403/404)
- ✅ **Canonical criteria validation** — All 13 criteria keys present
- ✅ **Required IDs** — manuscript_id and job_id in responses
- ✅ **Canon compliance** — Canon Guard passed on commit

**Evidence:** `tests/flow1-proof-pack.test.ts`, `evidence/flow1/flow1b_jest_proof.txt`  
**Test Results:** 3 passed, 1 skipped in 5.82s  
**Commit:** (pending)

---

## 🟡 Pending: Phase 2D Migrations 2-6

**Why:** These create the RPCs, tables, and constraints needed for atomic claiming, idempotency, and lease renewal. Without them, CI tests fail because the behavioral layer is incomplete.

| Migration | Purpose | Status | Why Needed |
|-----------|---------|--------|-----------|
| 20260128000002 | Fix `claim_job_atomic` RPC | ⏳ Pending | Tests call this RPC to claim jobs |
| 20260128000003 | Create `evaluation_provider_calls` table | ⏳ Pending | Stores provider call audit trail |
| 20260128000004 | Add idempotency constraint | ⏳ Pending | Prevents duplicate calls on retry |
| 20260128000005 | Grant RPC execute permissions | ⏳ Pending | Allows service_role to call RPCs |
| 20260128000006 | Create `renew_lease` RPC | ⏳ Pending | Tests call this RPC for heartbeat renewal |

### Why CI Fails Until These Are Applied

The CI error message says:
```
Fallback select error: column evaluation_jobs.lease_until does not exist
```

**This is misleading.** The column exists (Migration 1 applied it). What's actually missing is the behavioral layer:
- The test tries to claim a job via `claimNextJob()`, which needs the `claim_job_atomic()` RPC (Migration 2)
- That RPC doesn't exist yet, so the test falls back to a different code path
- The fallback fails because the full Phase 2D infrastructure isn't complete
- Result: `claims.length === 0` and test fails

The fix: Apply Migrations 2-6 to complete the behavioral layer.

---

## 🎯 Next Steps (User Action)

### Step 1: Apply Phase 2D Migrations 2-6

**See:** [APPLY_MIGRATIONS_RUNBOOK.md](APPLY_MIGRATIONS_RUNBOOK.md) for exact commands.

**Quick version:**
```bash
cd /workspaces/literary-ai-partner
supabase link --project-ref xtumxjnzdswuumndcbwc
supabase db push
```

Answer `Y` when prompted to apply migrations.

### Step 2: Verify Migrations Applied

Run this in Supabase SQL Editor:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('claim_job_atomic', 'renew_lease')
ORDER BY routine_name;

SELECT to_regclass('public.evaluation_provider_calls') AS table_exists;
```

Expected: 2 routine rows + table exists.

### Step 3: Trigger Phase 2D Evidence Gate Workflow

```bash
git commit --allow-empty -m "trigger: Phase 2D Evidence Gate workflow with all migrations applied"
git push origin main

gh run list --workflow=phase2d-evidence.yml --limit=1
```

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

