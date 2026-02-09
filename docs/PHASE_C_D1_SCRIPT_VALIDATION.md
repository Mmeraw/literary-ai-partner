# Phase C D1 Proof Script — Final Validation

**Status**: ✅ READY FOR EXECUTION  
**Date**: 2026-02-08  
**Script**: `scripts/phase-c-d1-proof.sh`

---

## Validation Checklist

| Check | Status | Details |
|-------|--------|---------|
| **Bash Syntax** | ✅ | `bash -n phase-c-d1-proof.sh` passes |
| **No Stray Text** | ✅ | Script ends cleanly at `exit 1` |
| **Shebang** | ✅ | Uses `#!/usr/bin/env bash` (portable) |
| **Exit Codes** | ✅ | 0=PASS, 1=Proof Failed, 2=Operator Error |
| **Evidence Capture** | ✅ | Auto-logs to `evidence/phase-c/d1/proof-*.log` |
| **Credential Redaction** | ✅ | Logs show `postgresql://***:***@host...` |
| **Config Overrides** | ✅ | All assumptions can be overridden via env vars |

---

## Schema Assumptions (Critical)

**Default assumptions**:
```bash
D1_SCHEMA="public"          # PostgreSQL schema name
D1_TABLE="jobs"             # Table name
progress column             # JSONB data type
```

**Required fields in progress JSONB**:
- `failed_at` (timestamp when job failed)
- `failure_reason` (error code string)
- `attempt_count` (integer: retry counter)

**If your schema is different**, override at runtime:
```bash
export D1_SCHEMA="your_schema"
export D1_TABLE="your_table_name"
./scripts/phase-c-d1-proof.sh
```

---

## How to Execute

### Prerequisites
1. PostgreSQL client (`psql`) installed
2. `SUPABASE_DB_URL_CI` set in environment (from secrets, not shown in code)

### One-Command Execution
```bash
# Set from secrets (do not paste into chat)
export SUPABASE_DB_URL_CI="postgresql://..."

# Run the proof
./scripts/phase-c-d1-proof.sh

# Proof logs automatically captured to: evidence/phase-c/d1/proof-*.log
```

### Exit Code Handling (for CI)
```bash
./scripts/phase-c-d1-proof.sh
EC=$?

if [[ $EC -eq 0 ]]; then
  echo "✅ D1 PASS"
  exit 0
elif [[ $EC -eq 1 ]]; then
  echo "❌ D1 FAIL: Envelope contract violated"
  exit 1
elif [[ $EC -eq 2 ]]; then
  echo "❌ SCRIPT ERROR: Missing env var, tool, or schema mismatch"
  exit 1
fi
```

---

## What Happens on Execution

### On PASS (violations = 0)
```
✅ D1 PASS: All failed jobs have required envelope fields

D1 Acceptance Criteria Met:
  [✅] Spec exists (FAILURE_ENVELOPE_v1.md)
  [✅] Runtime wiring verified (mapDbRowToJob())
  [✅] Proof query clean (0 violations)
  [✅] Evidence captured (this log)

D1 Status: ✅ DONE
```
**Exit code**: 0  
**Evidence**: `evidence/phase-c/d1/proof-2026-02-08T*.log`

### On FAIL (violations > 0)
- Shows count of failed jobs with missing fields
- Drill-down query lists each problematic job
- Shows which fields (failed_at / failure_reason / attempt_count) are missing
- Suggests fixes:
  1. Identify the write path that caused this
  2. Ensure failures set all required fields
  3. Backfill legacy rows OR accept exceptions
  4. Re-run until violations = 0

**Exit code**: 1

### On SCRIPT ERROR
- Missing `SUPABASE_DB_URL_CI` env var
- `psql` not installed
- Schema/table doesn't exist
- SQL query timeout

**Exit code**: 2

---

## Evidence Archive

Once executed successfully, you have:

```
evidence/phase-c/d1/
└── proof-2026-02-08T14-30-45Z.log
```

**Log contains**:
- Timestamp of execution (UTC)
- Redacted DB connection string (credentials masked)
- Q0 query result (violations count)
- If violations > 0: drill-down showing each problematic job
- Full D1 acceptance checklist

**Safe to commit** (credentials are redacted):
```bash
git add evidence/phase-c/d1/proof-*.log
git commit -m "docs: Phase C D1 proof execution ($(date -u +%Y-%m-%d))"
```

---

## Next Steps (Once Proof is Executed)

1. **If violations = 0**:
   - Update `PHASE_C_EVIDENCE_PACK.md` → D1 Status: ✅ DONE
   - Attach evidence log as proof
   - Move to D2 (Structured Logs)

2. **If violations > 0**:
   - Investigate the listed jobs
   - Fix the write paths (identify which phase or API call didn't set fields)
   - Backfill legacy rows OR accept them as exceptions
   - Re-run script until clean

---

## Quick Reference

| Item | Location |
|------|----------|
| Proof Script | `scripts/phase-c-d1-proof.sh` |
| Evidence Logs | `evidence/phase-c/d1/proof-*.log` |
| Spec Contract | `docs/FAILURE_ENVELOPE_v1.md` |
| Observability Queries | `docs/queries/OBSERVABILITY_QUERIES_v1.sql` |
| Evidence Pack | `PHASE_C_EVIDENCE_PACK.md` |
| Integration Guide | `docs/PHASE_C_D1_INTEGRATION.md` |

---

## Governance Alignment

✅ **Reference, don't reveal**: Credentials stored in secrets, script refers to env var  
✅ **Auditable**: Full execution log captured with timestamps and redacted URLs  
✅ **Repeatable**: Script is deterministic; idempotent (run multiple times safely)  
✅ **CI-friendly**: Exit codes and log capture designed for GitHub Actions  

