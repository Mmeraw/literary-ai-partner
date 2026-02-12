#!/bin/bash

#
# Phase 2E Evidence Verification Script
# 
# Verifies canonical user_id RLS migrations and policies
# Usage: ./scripts/evidence-phase2e.sh
#
# Environment variables:
#   - SUPABASE_URL: Supabase project URL
#   - SUPABASE_SERVICE_ROLE_KEY: Service role API key
#   - SUPABASE_ANON_KEY: Supabase anon key (required for REST)
#

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Timestamp for log files
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
LOG_DIR="${PROJECT_ROOT}/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="${LOG_DIR}/phase2e-evidence_${TIMESTAMP}.log"

echo "=== Phase 2E Evidence Verification ===" | tee -a "$LOG_FILE"
echo "Start: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
echo "Log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Verify environment
echo "Checking environment..." | tee -a "$LOG_FILE"
if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}✗ SUPABASE_URL not set${NC}" | tee -a "$LOG_FILE"
  exit 1
fi
echo -e "${GREEN}✓ SUPABASE_URL present${NC}" | tee -a "$LOG_FILE"

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY not set${NC}" | tee -a "$LOG_FILE"
  exit 1
fi
echo -e "${GREEN}✓ SUPABASE_SERVICE_ROLE_KEY present${NC}" | tee -a "$LOG_FILE"

if [ -z "$SUPABASE_ANON_KEY" ]; then
  echo -e "${RED}✗ SUPABASE_ANON_KEY not set${NC}" | tee -a "$LOG_FILE"
  exit 1
fi
echo -e "${GREEN}✓ SUPABASE_ANON_KEY present${NC}" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Extract project ID
PROJECT_ID=$(echo "$SUPABASE_URL" | grep -oP '(?<=https://)[^.]+' || echo "unknown")
echo "Project ID: $PROJECT_ID" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Verify RLS policies via Supabase RPC
echo "=== Verifying RLS Policies (RPC) ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper: Query RPC with diagnostics
query_policies_rpc() {
  local rpc_endpoint="$SUPABASE_URL/rest/v1/rpc/verify_phase2e_rls_policies"
  echo "Calling RPC: $rpc_endpoint" | tee -a "$LOG_FILE"

  local FULL_RESPONSE=$(curl -sS -w "\n__HTTP_STATUS:%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$rpc_endpoint" 2>&1)

  local HTTP_CODE=$(echo "$FULL_RESPONSE" | grep "__HTTP_STATUS" | cut -d: -f2)
  local BODY=$(echo "$FULL_RESPONSE" | sed '/__HTTP_STATUS/d')

  echo "  HTTP Status: $HTTP_CODE" | tee -a "$LOG_FILE"
  echo "  Response preview: $(echo "$BODY" | head -c 150)..." | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"

  if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}✗ FAILED: HTTP $HTTP_CODE (RPC call failed)${NC}" | tee -a "$LOG_FILE"
    echo "  Response body: $BODY" | tee -a "$LOG_FILE"
    ((CHECKS_FAILED++))
    return 1
  fi

  BODY="$BODY" python - <<'PY'
import json
import os
import sys

body = os.environ.get("BODY", "")

try:
    data = json.loads(body)
except Exception:
    print("  ✗ FAILED: Response is not valid JSON")
    sys.exit(1)

expected_tables = ["manuscripts", "manuscript_chunks"]
failed = False

for table in expected_tables:
    rows = [r for r in data if r.get("tablename") == table]
    if not rows:
        print(f"  ✗ FAILED: No rows returned for table {table} (table missing or RPC misconfigured)")
        failed = True
        continue

    if any(r.get("rls_enabled") is True for r in rows):
        print(f"  ✓ {table} RLS enabled")
    else:
        print(f"  ✗ FAILED: RLS not enabled for {table}")
        failed = True

    policies = [r for r in rows if r.get("policyname")]
    if policies:
        print(f"  ✓ {table} policies found: {len(policies)}")
    else:
        print(f"  ✗ FAILED: No policies found for {table}")
        failed = True

if failed:
    sys.exit(1)
PY

  if [ $? -eq 0 ]; then
    ((CHECKS_PASSED++))
    return 0
  fi

  ((CHECKS_FAILED++))
  return 1
}

query_policies_rpc

echo "" | tee -a "$LOG_FILE"

# Summary
echo "=== Phase 2E Verification Summary ===" | tee -a "$LOG_FILE"
echo "Checks passed: $CHECKS_PASSED" | tee -a "$LOG_FILE"
echo "Checks failed: $CHECKS_FAILED" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

if [ "$CHECKS_FAILED" -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 2E Evidence: LOCKED${NC}" | tee -a "$LOG_FILE"
  echo "End: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "Evidence archived: $LOG_FILE" | tee -a "$LOG_FILE"
  exit 0
else
  echo -e "${RED}❌ Phase 2E Evidence: FAILED${NC}" | tee -a "$LOG_FILE"
  echo "End: $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  echo "Evidence archived: $LOG_FILE" | tee -a "$LOG_FILE"
  exit 1
fi
