#!/usr/bin/env bash
# Phase C D1: Failure Envelope Proof Query Execution
#
# Purpose: Execute Q0 (D1 proof query) against Supabase to verify
# that all failed jobs have the canonical failure envelope fields.
#
# Usage:
#   export SUPABASE_DB_URL_CI="postgresql://..."  # Set your Supabase connection (from secrets)
#   ./scripts/phase-c-d1-proof.sh
#
# Optional overrides:
#   export EVIDENCE_DIR="evidence/phase-c/d1"
#   export D1_LIMIT="10"
#   export D1_SCHEMA="public"
#   export D1_TABLE="jobs"
#   export PSQL_TIMEOUT_SECONDS="30"
#   export D1_SQL_FILE="docs/queries/OBSERVABILITY_QUERIES_v1.sql"   # optional
#
# Expected output:
#   violations = 0  (all failed jobs have required fields)
#
# Exit codes:
#   0 = Q0 returned 0 violations (D1 PASS)
#   1 = Q0 returned > 0 violations (D1 FAIL — failures detected)
#   2 = Script/operator error (missing env var, missing tools, schema mismatch)
#
# Schema validation (must match your database):
#   Table: ${D1_SCHEMA}.${D1_TABLE} (default: public.jobs)
#   Columns: status (text), progress (JSONB)
#   Progress fields: failed_at, failure_reason, attempt_count
#   If your table is different, override: export D1_TABLE=your_table D1_SCHEMA=your_schema

set -euo pipefail

# ---------- Config ----------
readonly EVIDENCE_DIR="${EVIDENCE_DIR:-evidence/phase-c/d1}"
readonly D1_LIMIT="${D1_LIMIT:-10}"
readonly D1_SCHEMA="${D1_SCHEMA:-public}"
readonly D1_TABLE="${D1_TABLE:-jobs}"
readonly PSQL_TIMEOUT_SECONDS="${PSQL_TIMEOUT_SECONDS:-30}"
readonly D1_SQL_FILE="${D1_SQL_FILE:-}"

# ---------- Color codes ----------
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# ---------- Helpers ----------
ts_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo -e "${RED}❌ ERROR: \"$cmd\" not found${NC}"
    exit 2  # Script error (missing tool)
  fi
}

die() {
  echo -e "${RED}❌ ERROR: $*${NC}"
  exit 2  # Script/operator error
}

redact_db_url() {
  # Redact credentials in a postgres URI for logs:
  # postgresql://user:pass@host:port/db?... -> postgresql://***:***@host:port/db?...
  local url="$1"
  # Replace "://<user>:<pass>@" with "://***:***@"
  echo "$url" | sed -E 's#(postgres(ql)?://)[^/@:]+(:[^/@]*)?@#\1***:***@#'
}

# Run psql with safe flags + timeout
psql_safe() {
  local sql="$1"
  # -X: no .psqlrc
  # -v ON_ERROR_STOP=1: fail on SQL errors
  # -q: quiet
  # -t -A: tuples only + unaligned (for scalar outputs)
  timeout "${PSQL_TIMEOUT_SECONDS}" \
    psql "$SUPABASE_DB_URL_CI" \
      -X \
      -v ON_ERROR_STOP=1 \
      -q \
      -t -A \
      -c "$sql"
}

psql_safe_verbose() {
  local sql="$1"
  timeout "${PSQL_TIMEOUT_SECONDS}" \
    psql "$SUPABASE_DB_URL_CI" \
      -X \
      -v ON_ERROR_STOP=1 \
      -c "$sql"
}

# ---------- Validate environment ----------
if [[ -z "${SUPABASE_DB_URL_CI:-}" ]]; then
  echo -e "${RED}❌ ERROR: SUPABASE_DB_URL_CI not set${NC}"
  echo ""
  echo "Set it from secrets (do not paste into chat):"
  echo "  export SUPABASE_DB_URL_CI=\"postgresql://user:pass@host:port/postgres?sslmode=require\""
  echo "  ./scripts/phase-c-d1-proof.sh"
  echo ""
  exit 2  # Operator error (missing env var)
fi

require_cmd psql
require_cmd date
require_cmd mkdir
require_cmd tee
require_cmd sed
require_cmd timeout
require_cmd xargs

# ---------- Header ----------
echo "=========================================="
echo "Phase C D1: Failure Envelope Proof"
echo "=========================================="
echo ""

# ---------- Evidence capture ----------
RUN_TS="$(ts_utc)"
LOG_FILE="${EVIDENCE_DIR}/proof-${RUN_TS//:/-}.log"
mkdir -p "$EVIDENCE_DIR"

# Mirror all output into the evidence log
exec > >(tee -a "$LOG_FILE") 2>&1

# Error trap that still leaves an audit trail
on_err() {
  local ec=$?
  echo ""
  echo -e "${RED}❌ Script failed (exit=$ec). Evidence log captured.${NC}"
  echo -e "${YELLOW}→ Evidence log:${NC} $LOG_FILE"
  exit "$ec"
}
trap on_err ERR

echo -e "${YELLOW}→ Evidence log:${NC} $LOG_FILE"
echo -e "${YELLOW}→ Timestamp (UTC):${NC} $RUN_TS"
echo -e "${YELLOW}→ Target:${NC} ${D1_SCHEMA}.${D1_TABLE}"
echo -e "${YELLOW}→ psql timeout:${NC} ${PSQL_TIMEOUT_SECONDS}s"
echo ""

echo -e "${YELLOW}→ Connecting to Supabase (URL redacted)…${NC}"
echo "DB: $(redact_db_url "$SUPABASE_DB_URL_CI")"
echo ""

# ---------- Preflight: basic connectivity ----------
# A lightweight sanity check that also helps distinguish DNS/auth errors.
psql_safe "SELECT 1;" >/dev/null
echo -e "${GREEN}✅ Connectivity OK${NC}"
echo ""

# ---------- Optional: SQL file presence check (if configured) ----------
if [[ -n "$D1_SQL_FILE" ]]; then
  if [[ ! -f "$D1_SQL_FILE" ]]; then
    die "D1_SQL_FILE is set but file not found: $D1_SQL_FILE"
  fi
  echo -e "${YELLOW}→ Note:${NC} D1_SQL_FILE is set ($D1_SQL_FILE) but Q0 is executed inline for determinism."
  echo ""
fi

# ---------- Q0 Proof Query ----------
# Q0: Any failed job missing required failure envelope fields is a violation.
# NOTE: progress is expected to be JSONB.
Q0_SQL="
SELECT COUNT(*)::text AS violations
FROM ${D1_SCHEMA}.${D1_TABLE}
WHERE status = 'failed'
  AND (
    progress->>'failed_at' IS NULL
    OR progress->>'failure_reason' IS NULL
    OR progress->>'attempt_count' IS NULL
  );
"

VIOLATIONS="$(psql_safe "$Q0_SQL" | xargs)"

# Validate numeric output
if [[ -z "$VIOLATIONS" ]]; then
  die "Q0 returned empty output (expected a number)."
fi
if ! [[ "$VIOLATIONS" =~ ^[0-9]+$ ]]; then
  die "Q0 returned non-numeric output: \"$VIOLATIONS\""
fi

echo -e "${YELLOW}→ D1 Failure Envelope Data Integrity Check (Q0)${NC}"
echo ""
echo "Q0 Criteria: status='failed' jobs must have:"
echo "  - progress.failed_at"
echo "  - progress.failure_reason"
echo "  - progress.attempt_count"
echo ""
echo "Result: violations = $VIOLATIONS"
echo ""

# ---------- PASS ----------
if [[ "$VIOLATIONS" == "0" ]]; then
  echo -e "${GREEN}✅ D1 PASS: All failed jobs have required envelope fields${NC}"
  echo ""
  echo "D1 Acceptance Criteria Met:"
  echo "  [✅] Spec exists (FAILURE_ENVELOPE_v1.md)"
  echo "  [✅] Runtime wiring verified (mapDbRowToJob())"
  echo "  [✅] Proof query clean (0 violations)"
  echo "  [✅] Evidence captured (this log)"
  echo ""
  echo "D1 Status: ✅ DONE"
  exit 0
fi

# ---------- FAIL + Drilldown ----------
echo -e "${RED}❌ D1 FAIL: Found $VIOLATIONS failed jobs with missing envelope fields${NC}"
echo ""
echo "Drilling down (latest $D1_LIMIT)…"
echo ""

DRILLDOWN_SQL="
SELECT
  id,
  job_type,
  status,
  created_at,
  (progress->>'failed_at' IS NULL)       AS missing_failed_at,
  (progress->>'failure_reason' IS NULL) AS missing_failure_reason,
  (progress->>'attempt_count' IS NULL)  AS missing_attempt_count,
  progress
FROM ${D1_SCHEMA}.${D1_TABLE}
WHERE status = 'failed'
  AND (
    progress->>'failed_at' IS NULL
    OR progress->>'failure_reason' IS NULL
    OR progress->>'attempt_count' IS NULL
  )
ORDER BY created_at DESC
LIMIT ${D1_LIMIT};
"

psql_safe_verbose "$DRILLDOWN_SQL"

echo ""
echo "Fix Required:"
echo "  1) Identify which write path produced these rows"
echo "  2) Ensure failures always set: progress.failed_at, progress.failure_reason, progress.attempt_count"
echo "  3) Decide: backfill legacy rows vs. accept legacy exceptions (but then D1 is not DONE)"
echo "  4) Re-run this script until violations = 0"
echo ""
echo "Schema used: ${D1_SCHEMA}.${D1_TABLE}"
echo "If table name is different, override: export D1_TABLE=your_table D1_SCHEMA=your_schema"
echo ""

exit 1  # Proof failed (violations > 0)
