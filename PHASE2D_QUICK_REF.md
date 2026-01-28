# Phase 2D Quick Reference Card

## Status at a Glance
- ✅ Secrets configured (all 5)
- ✅ Code fallbacks fixed  
- ✅ Migration 1 applied (lease fields)
- ⏳ **Migrations 2-6 need manual application**

## One-Line Status
**Waiting for:** User to apply 5 Phase 2D SQL migrations to Supabase production, then workflow will run and either PASS or reveal code bugs.

## What's Ready for You

### SQL Migration File
```
/tmp/phase2d-2-6.sql  (147 lines, ready to copy/paste)
```

### Detailed Instructions
```
APPLY_PHASE2D_2-6.md  (step-by-step guide)
```

### Full Status Document  
```
PHASE2D_STATUS.md  (complete timeline & checklist)
```

---

## 🚀 IMMEDIATE ACTION (5 minutes)

```bash
# 1. Copy the SQL
cat /tmp/phase2d-2-6.sql

# 2. Paste into Supabase Dashboard
# → SQL Editor → New Query → Paste → Run
# → Project: xtumxjnzdswuumndcbwc (RevisionGrade Production)

# 3. After migrations apply, trigger workflow
git commit --allow-empty -m "trigger: Phase 2D after migrations"
git push origin main

# 4. Monitor
gh run list --workflow=phase2d-evidence.yml --limit=1
```

---

## What Each Migration Does

| # | File | What | When Ready |
|---|------|------|-----------|
| 1 | M1 | Columns: worker_id, lease_until, etc | ✅ Applied |
| 2 | M2 | RPC: claim_job_atomic() | ⏳ Pending |
| 3 | M3 | Table: evaluation_provider_calls | ⏳ Pending |
| 4 | M4 | Constraint: unique_provider_call_per_job | ⏳ Pending |
| 5 | M5 | Permissions: GRANT EXECUTE | ⏳ Pending |
| 6 | M6 | RPC: renew_lease() | ⏳ Pending |

---

## Expected Outcomes

### ✅ Success (Most Likely)
All 3 slices pass → Phase 2D locked → Move to Phase 2E

### ❌ Partial Failure (Also OK)
Slice 1-2 pass, Slice 3 fails on logic → Fix the code assertion, re-run

### 🔴 SQL Error
One of migrations 2-6 conflicts → See detailed logs, may need manual fix

---

## Key Commits
- 05fe77e: Fix workers/claimJob.ts fallback
- 7112a79: Diagnostic analysis (database schema issue identified)
- 36f1f3c: Migrations 2-6 application guide
- fa9112b: Comprehensive Phase 2D status

---

## Files to Review
1. [PHASE2D_STATUS.md](PHASE2D_STATUS.md) — Full context
2. [APPLY_PHASE2D_2-6.md](APPLY_PHASE2D_2-6.md) — Step-by-step
3. `/tmp/phase2d-2-6.sql` — The SQL to run

---

**Bottom Line:** Everything is ready. Just apply the 5 SQL migrations to Supabase, push a commit, and see the results.
