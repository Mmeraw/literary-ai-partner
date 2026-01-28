# Phase 2D: Apply Migrations 2-6 via Codespace

## ✅ What We Know (Facts Only)

1. **Migration 1 is applied** to Supabase production (confirmed via screenshot + indexes exist)
2. **Migrations 2-6 exist locally** in `supabase/migrations/` directory (confirmed via `ls`)
3. **Migrations 2-6 are NOT applied** to Supabase production yet
4. **CI is failing** because Phase 2D test runs real DB queries that need the RPCs/grants/tables from Migrations 2-6

## ❌ Why CI Still Fails (Corrected)

The CI error message says:
```
Fallback select error: column evaluation_jobs.lease_until does not exist
```

**This is misleading.** The column DOES exist (Migration 1 applied it + indexes prove it).

**What's actually happening:**

The test tries to claim a job by calling `claimNextJob()`, which internally executes the `claim_job_atomic` RPC. But that RPC doesn't exist yet (Migration 2 not applied). The worker code then falls back to a different query path, which emits a confusing error message about the column.

**The real root cause:** Migrations 2-6 haven't been applied yet, so the behavioral layer is missing:
- RPC: `claim_job_atomic()` — **MISSING** (Migration 2)
- Table: `evaluation_provider_calls` — **MISSING** (Migration 3)
- Constraint: `unique_provider_call_per_job` — **MISSING** (Migration 4)
- RPC grants — **MISSING** (Migration 5)
- RPC: `renew_lease()` — **MISSING** (Migration 6)

---

## 🚀 Runbook: Apply Migrations 2-6 (Copy-Paste)

Open your Codespace terminal and run these commands in order:

### Step 1: Navigate to project

```bash
cd /workspaces/literary-ai-partner
```

### Step 2: Verify Supabase CLI is installed

```bash
supabase --version
```

Expected output: `supabase version X.Y.Z`

### Step 3: Link to production project (you may be prompted to authenticate)

```bash
supabase link --project-ref xtumxjnzdswuumndcbwc
```

Expected output: `Finished supabase link.`

### Step 4: Push all unapplied migrations

```bash
supabase db push
```

You will see a prompt:
```
Do you want to push these migrations to the remote database?
• 20260124000000_evaluation_artifacts.sql
• 20260124000001_add_job_id_to_chunks.sql
• ... (many more)
• 20260128000002_fix_claim_job_atomic_eval_jobs.sql
• 20260128000003_add_evaluation_provider_calls.sql
• 20260128000004_add_provider_calls_idempotency.sql
• 20260128000005_grant_claim_job.sql
• 20260128000006_add_renew_lease_rpc.sql

[Y/n] Y
```

**Type `Y` and press Enter.**

### Expected Output (Success Path)

```
Applying migration 20260128000002_fix_claim_job_atomic_eval_jobs.sql...
Applying migration 20260128000003_add_evaluation_provider_calls.sql...
Applying migration 20260128000004_add_provider_calls_idempotency.sql...
Applying migration 20260128000005_grant_claim_job.sql...
Applying migration 20260128000006_add_renew_lease_rpc.sql...
✓ All migrations applied successfully
```

### If You Hit "Remote Changes Detected" Error

Run this (safe, non-destructive):

```bash
supabase db pull
supabase db push
```

Then repeat the push command.

---

## ✅ Verify Migrations Were Applied

Open **Supabase SQL Editor** (in your browser) and run this query:

```sql
-- Check RPCs exist
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('claim_job_atomic', 'renew_lease')
ORDER BY routine_name;

-- Check provider_calls table exists
SELECT to_regclass('public.evaluation_provider_calls') AS table_exists;
```

**Expected results:**
- First query: 2 rows (`claim_job_atomic`, `renew_lease`)
- Second query: `public.evaluation_provider_calls` (not NULL)

If you see these, migrations 2-6 are in place. ✅

---

## 🎯 After Migrations Are Applied

### Step 1: Trigger the workflow

```bash
git commit --allow-empty -m "trigger: Phase 2D Evidence Gate with migrations 2-6 applied"
git push origin main
```

### Step 2: Monitor the run

```bash
gh run list --workflow=phase2d-evidence.yml --limit=1
```

### Step 3: Expected Outcomes

Now the CI will actually execute Phase 2D tests and either:

**✅ PASS (Best case)**
```
Phase 2D-1 Atomic claim concurrency: ✅ PASS
Phase 2D-2 Idempotency proof: ✅ PASS
Phase 2D-3 Reconciler + heartbeat: ✅ PASS
→ Phase 2D Evidence: LOCKED
```

**❌ FAIL on logic (Expected case)**
```
Phase 2D-1 Atomic claim concurrency: ✅ PASS
Phase 2D-2 Idempotency proof: ✅ PASS
Phase 2D-3 Reconciler + heartbeat: ❌ FAIL
  → expect(received).toHaveLength(1)
     Received length: 0
     Received array: []
```

If you get a logic failure, it tells you exactly what to fix in code. That's progress.

**🔴 SQL Error (Rare)**
If you get a Postgres error, check the error message and run the verification query above to confirm RPCs/table exist.

---

## 📝 Summary

| Step | Command | What It Does |
|------|---------|---|
| 1 | `cd /workspaces/literary-ai-partner` | Enter project |
| 2 | `supabase --version` | Verify CLI exists |
| 3 | `supabase link --project-ref xtumxjnzdswuumndcbwc` | Link to production |
| 4 | `supabase db push` | Apply migrations 2-6 to Supabase |
| 5 | (SQL query in Supabase UI) | Verify RPCs/table exist |
| 6 | `git commit --allow-empty ...` | Trigger workflow |
| 7 | `gh run list --workflow=...` | Monitor results |

**Time estimate:** 5-10 minutes total.

---

## 🔑 Key Point

The `supabase db push` command is the **governance-safe** way to apply migrations because it:
- Reads from local migration files (no manual copy/paste errors)
- Applies in correct timestamp order
- Tracks which migrations have been applied
- Is repeatable and auditable

Do NOT manually copy/paste migration SQL. Use `supabase db push`.
