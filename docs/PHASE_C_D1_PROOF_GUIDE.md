# Phase C D1: Proof Execution Guide

**Purpose**: Quick reference for running the D1 proof query and capturing evidence.  
**Time Required**: ~5–10 minutes (once Supabase credentials are available)  
**Date**: 2026-02-08

---

## One-Liner (D1 Proof)

```bash
export SUPABASE_DB_URL_CI="postgresql://..."  # Set your Supabase connection string
psql "$SUPABASE_DB_URL_CI" -c "
SELECT COUNT(*) as violations
FROM jobs
WHERE status = 'failed'
AND (
  progress->>'failed_at' IS NULL
  OR progress->>'failure_reason' IS NULL
  OR progress->>'attempt_count' IS NULL
);"
```

**Expected Output**: `violations | 0`

If you get `0`: ✅ D1 envelope contract is satisfied in the database  
If you get `> 0`: ❌ Legacy or broken write paths exist; investigate the rows

---

## Step-by-Step Proof Execution

### 1. Set Up Connection

```bash
# Option A: Export the environment variable (from GitHub secrets or .env)
export SUPABASE_DB_URL_CI="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require"

# Option B: Test the connection
psql "$SUPABASE_DB_URL_CI" -c "SELECT pg_database.datname FROM pg_database WHERE datname = current_database();"
# Expected: Shows your database name (e.g., postgres)
```

---

### 2. Run D1 Proof Query (Q0)

```bash
# Execute Q0 from the observability queries
psql "$SUPABASE_DB_URL_CI" -f docs/queries/OBSERVABILITY_QUERIES_v1.sql \
  --command "
  -- D1 Failure Envelope Data Integrity Check
  SELECT
    COUNT(*) as violations,
    COUNT(*) FILTER (WHERE progress->>'failed_at' IS NULL) as missing_failed_at,
    COUNT(*) FILTER (WHERE progress->>'failure_reason' IS NULL) as missing_failure_reason,
    COUNT(*) FILTER (WHERE progress->>'attempt_count' IS NULL) as missing_attempt_count
  FROM jobs
  WHERE status = 'failed';
  "
```

**Interpretation**:

| Result | Meaning | Action |
|--------|---------|--------|
| `violations=0` | All failed jobs have required fields ✅ | **D1 PASS** → Move to evidence capture |
| `violations>0` | Some failed jobs missing required fields ❌ | Investigate the specific missing fields |

---

### 3. Drill Down (If Violations Exist)

If you find violations, identify which write paths are broken:

```sql
-- Find specific failed jobs with missing required fields
SELECT
  id,
  job_type,
  status,
  progress->>'failed_at' as failed_at_present,
  progress->>'failure_reason' as failure_reason_present,
  progress->>'attempt_count' as attempt_count_present,
  progress as full_progress
FROM jobs
WHERE status = 'failed'
AND (
  progress->>'failed_at' IS NULL
  OR progress->>'failure_reason' IS NULL
  OR progress->>'attempt_count' IS NULL
)
LIMIT 10;
```

Then trace back:
- **Missing `failed_at`**: Check phase1.ts, phase2.ts for "mark as failed" logic
- **Missing `failure_reason`**: Check error handling in phase transitions
- **Missing `attempt_count`**: Check job initialization (should default to 1)

---

### 4. Capture Evidence

Once Q0 returns `violations = 0`, capture the proof:

```bash
# Create evidence directory
mkdir -p evidence/phase-c/d1

# Run full observability query suite and capture output
psql "$SUPABASE_DB_URL_CI" -f docs/queries/OBSERVABILITY_QUERIES_v1.sql \
  | tee evidence/phase-c/d1/proof-$(date -u +%Y%m%dT%H%M%SZ).log

# Verify D1 query specifically (Q0)
psql "$SUPABASE_DB_URL_CI" -c "
SELECT 
  'D1 Failure Envelope Proof' as test_name,
  COUNT(*) as total_failed_jobs,
  COUNT(*) FILTER (WHERE progress->>'failed_at' IS NULL) as missing_failed_at,
  COUNT(*) FILTER (WHERE progress->>'failure_reason' IS NULL) as missing_failure_reason,
  COUNT(*) FILTER (WHERE progress->>'attempt_count' IS NULL) as missing_attempt_count,
  CASE WHEN COUNT(*) FILTER (WHERE progress->>'failed_at' IS NULL OR progress->>'failure_reason' IS NULL OR progress->>'attempt_count' IS NULL) = 0 THEN 'PASS' ELSE 'FAIL' END as result
FROM jobs
WHERE status = 'failed';" \
  | tee evidence/phase-c/d1/d1-integrity-check-$(date -u +%Y%m%dT%H%M%SZ).txt
```

---

### 5. Capture Real Examples (One Per Failure Class)

```bash
# Example 1: Canceled job
psql "$SUPABASE_DB_URL_CI" -c "
SELECT 'canceled' as failure_class, id, status, progress 
FROM jobs 
WHERE status = 'failed' 
AND progress->>'canceled_at' IS NOT NULL 
LIMIT 1;" > evidence/phase-c/d1/example-canceled.json

# Example 2: Retryable job
psql "$SUPABASE_DB_URL_CI" -c "
SELECT 'retryable' as failure_class, id, status, progress 
FROM jobs 
WHERE status = 'failed' 
AND progress->>'next_retry_at' IS NOT NULL 
AND (progress->>'attempt_count')::int < 5
LIMIT 1;" > evidence/phase-c/d1/example-retryable.json

# Example 3: Deadletter staging (approaching limit)
psql "$SUPABASE_DB_URL_CI" -c "
SELECT 'deadletter' as failure_class, id, status, progress 
FROM jobs 
WHERE status = 'failed' 
AND (progress->>'attempt_count')::int >= 4
LIMIT 1;" > evidence/phase-c/d1/example-deadletter.json

# Verify examples were captured
ls -la evidence/phase-c/d1/example-*.json
```

---

## Evidence Checklist

After execution, populate this checklist:

```markdown
# D1 Proof Evidence — Completed

Date Completed: 2026-02-08  
Executed By: _______________  

## Proof Query Results

- [x] Q0 executed against Supabase
- [x] Q0 returned: violations = 0
- [x] Execution timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)
- [x] Output archived: evidence/phase-c/d1/proof-*.log

## Real Failure Examples

- [x] Canceled example archived: evidence/phase-c/d1/example-canceled.json
- [x] Retryable example archived: evidence/phase-c/d1/example-retryable.json
- [x] Deadletter example archived: evidence/phase-c/d1/example-deadletter.json

## Spec & Contracts

- [x] Spec reviewed: docs/FAILURE_ENVELOPE_v1.md ✅
- [x] Links to Phase A.1 validated ✅
- [x] Links to Phase 2C validated ✅

## D1 Sign-Off

**Result**: PASS ✅

All requirements met:
- A. Spec exists ✅
- B. Runtime wiring validated (mapDbRowToJob()) ✅
- C. Proof query clean (0 violations) ✅
- D. Evidence captured ✅

**D1 Status**: ✅ DONE
```

---

## Troubleshooting

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| `psql: command not found` | PostgreSQL CLI not installed | Install postgresql client: `brew install postgresql` or `apt install postgresql-client` |
| Connection refused | Wrong host/port | Verify `SUPABASE_DB_URL_CI` has correct host/port/credentials |
| `does not exist` (schema error) | jobs table missing or different name | Run `SELECT * FROM information_schema.tables WHERE table_name='jobs';` to find the table |
| `violations > 0` | D1 contract violated | Investigate the specific missing fields (see "Drill Down" section above) |
| Q0 returns nothing | Query timeout or DB issue | Check DB logs; try limiting to recent jobs: `WHERE status = 'failed' AND created_at > NOW() - INTERVAL '30 days'` |

---

## Summary

**Time to D1 PASS**: ~5 minutes if Supabase credentials are available  
**Evidence Location**: `evidence/phase-c/d1/`  
**Next Phase**: Once D1 is DONE, execute D2–D5 in sequence (or parallelize D2 & D3/D4 code work while D3 queries run on real data)

