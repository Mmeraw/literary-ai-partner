#!/usr/bin/env bash
# Phase C D3: Observability Queries Proof (Q1–Q3 against public.observability_events)
#
# Purpose:
#   Execute Q1–Q3 in a reachable environment (CI/self-hosted) and capture evidence.
#
# Usage:
#   export SUPABASE_DB_URL_CI="postgresql://..."   # from secrets (URL-encoded if needed)
#   ./scripts/phase-c-d3-proof.sh
#
# Optional overrides:
#   export EVIDENCE_DIR="evidence/phase-c/d3"
#   export PSQL_TIMEOUT_SECONDS="30"
#   export D3_SCHEMA="public"
#   export D3_TABLE="observability_events"
#   export D3_SINCE_HOURS="168"   # default: 7 days
#
# Exit codes:
#   0 = Script executed (evidence captured). (Queries are informational; not a PASS/FAIL gate.)
#   2 = Operator/script/infra error (missing env/tool, network, auth, SQL error)

set -euo pipefail

readonly EVIDENCE_DIR="${EVIDENCE_DIR:-evidence/phase-c/d3}"
readonly PSQL_TIMEOUT_SECONDS="${PSQL_TIMEOUT_SECONDS:-30}"
readonly D3_SCHEMA="${D3_SCHEMA:-public}"
readonly D3_TABLE="${D3_TABLE:-observability_events}"
readonly D3_SINCE_HOURS="${D3_SINCE_HOURS:-168}"

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

ts_utc() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || { echo -e "${RED}❌ ERROR: \"$cmd\" not found${NC}"; exit 2; }
}

die2() {
  echo -e "${RED}❌ ERROR: $*${NC}"
  exit 2
}

redact_db_url() {
  local url="$1"
  echo "$url" | sed -E 's#(postgres(ql)?://)[^/@:]+(:[^/@]*)?@#\1***:***@#'
}

psql_safe() {
  local sql="$1"
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

# ---- Validate env/tools ----
if [[ -z "${SUPABASE_DB_URL_CI:-}" ]]; then
  echo -e "${RED}❌ ERROR: SUPABASE_DB_URL_CI not set${NC}"
  exit 2
fi

require_cmd psql
require_cmd date
require_cmd mkdir
require_cmd tee
require_cmd sed
require_cmd timeout

# ---- Evidence capture ----
RUN_TS="$(ts_utc)"
LOG_FILE="${EVIDENCE_DIR}/proof-${RUN_TS//:/-}.log"
mkdir -p "$EVIDENCE_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

on_err() {
  local ec=$?
  echo ""
  echo -e "${RED}❌ Script failed (exit=$ec). Evidence log captured.${NC}"
  echo -e "${YELLOW}→ Evidence log:${NC} $LOG_FILE"
  exit 2
}
trap on_err ERR

echo "=========================================="
echo "Phase C D3: Observability Queries Proof"
echo "=========================================="
echo ""
echo -e "${YELLOW}→ Evidence log:${NC} $LOG_FILE"
echo -e "${YELLOW}→ Timestamp (UTC):${NC} $RUN_TS"
echo -e "${YELLOW}→ Target:${NC} ${D3_SCHEMA}.${D3_TABLE}"
echo -e "${YELLOW}→ Window:${NC} last ${D3_SINCE_HOURS} hour(s)"
echo -e "${YELLOW}→ psql timeout:${NC} ${PSQL_TIMEOUT_SECONDS}s"
echo ""
echo -e "${YELLOW}→ Connecting to DB (URL redacted)…${NC}"
echo "DB: $(redact_db_url "$SUPABASE_DB_URL_CI")"
echo ""

# ---- Preflight connectivity ----
psql_safe "SELECT 1;" >/dev/null
echo -e "${GREEN}✅ Connectivity OK${NC}"
echo ""

# ---- Shared filter ----
# Use recorded_at; switch to occurred_at if that’s your canonical time for analytics.
SINCE_FILTER="recorded_at >= (NOW() - INTERVAL '${D3_SINCE_HOURS} hours')"

# ---- Q1: Failure counts by failure_reason ----
Q1_SQL="
SELECT
  COALESCE(payload->>'failure_reason', 'MISSING_failure_reason') AS failure_reason,
  COUNT(*)::bigint AS failures
FROM ${D3_SCHEMA}.${D3_TABLE}
WHERE event_type = 'job.failed'
  AND ${SINCE_FILTER}
GROUP BY 1
ORDER BY 2 DESC, 1 ASC;
"

echo "------------------------------------------"
echo "Q1: failure counts by failure_reason (events)"
echo "------------------------------------------"
psql_safe_verbose "$Q1_SQL"
echo ""

# ---- Q2: Failure rate by job_type (job.failed vs job.completed) ----
# NOTE: Q2 is meaningful only when job.completed emits exist.
Q2_SQL="
WITH base AS (
  SELECT
    payload->>'job_type' AS job_type,
    event_type
  FROM ${D3_SCHEMA}.${D3_TABLE}
  WHERE event_type IN ('job.failed', 'job.completed')
    AND ${SINCE_FILTER}
),
agg AS (
  SELECT
    COALESCE(job_type, 'MISSING_job_type') AS job_type,
    COUNT(*) FILTER (WHERE event_type='job.failed')::bigint AS failed,
    COUNT(*) FILTER (WHERE event_type='job.completed')::bigint AS completed
  FROM base
  GROUP BY 1
)
SELECT
  job_type,
  failed,
  completed,
  CASE
    WHEN (failed + completed) = 0 THEN NULL
    ELSE ROUND((failed::numeric / (failed + completed)::numeric) * 100.0, 2)
  END AS failure_rate_pct
FROM agg
ORDER BY (failed + completed) DESC, job_type ASC;
"

echo "------------------------------------------"
echo "Q2: failure rate by job_type (events)"
echo "------------------------------------------"
echo "NOTE: Requires job.completed emits to be meaningful."
psql_safe_verbose "$Q2_SQL"
echo ""

# ---- Q3: Infra vs logic bucketing by failure_reason ----
# Keep this conservative; don’t “over-classify” until you have a canonical taxonomy.
Q3_SQL="
WITH failed AS (
  SELECT
    COALESCE(payload->>'failure_reason', 'MISSING_failure_reason') AS failure_reason
  FROM ${D3_SCHEMA}.${D3_TABLE}
  WHERE event_type='job.failed'
    AND ${SINCE_FILTER}
),
bucketed AS (
  SELECT
    failure_reason,
    CASE
      WHEN failure_reason ILIKE '%timeout%' THEN 'infra'
      WHEN failure_reason ILIKE '%network%' THEN 'infra'
      WHEN failure_reason ILIKE '%dns%' THEN 'infra'
      WHEN failure_reason ILIKE '%refused%' THEN 'infra'
      WHEN failure_reason ILIKE '%unreachable%' THEN 'infra'
      WHEN failure_reason ILIKE '%auth%' THEN 'infra'
      WHEN failure_reason ILIKE '%permission%' THEN 'infra'
      ELSE 'logic'
    END AS bucket
  FROM failed
)
SELECT
  bucket,
  COUNT(*)::bigint AS failures
FROM bucketed
GROUP BY 1
ORDER BY 2 DESC, 1 ASC;
"

echo "------------------------------------------"
echo "Q3: infra vs logic (events, by failure_reason)"
echo "------------------------------------------"
psql_safe_verbose "$Q3_SQL"
echo ""

echo -e "${GREEN}✅ D3 proof queries executed; evidence captured.${NC}"
echo -e "${YELLOW}→ Evidence log:${NC} $LOG_FILE"
echo ""
echo "Exit: 0 (informational evidence run)"
exit 0