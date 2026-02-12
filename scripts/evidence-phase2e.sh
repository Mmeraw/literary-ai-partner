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
echo "" | tee -a "$LOG_FILE"

# Extract project ID
PROJECT_ID=$(echo "$SUPABASE_URL" | grep -oP '(?<=https://)[^.]+' || echo "unknown")
echo "Project ID: $PROJECT_ID" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

# Verify RLS policies via Supabase API
echo "=== Verifying RLS Policies ===" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

CHECKS_PASSED=0
CHECKS_FAILED=0

# Helper: Query pg_policies with diagnostics
query_policies() {
  local table_to_check="$1"
  local check_name="$2"
  
  echo "Checking $check_name table RLS policies..." | tee -a "$LOG_FILE"
  
  # Capture response with HTTP status
  local FULL_RESPONSE=$(curl -sS -w "\n__HTTP_STATUS:%{http_code}" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    "$SUPABASE_URL/rest/v1/pg_policies?tablename=eq.$table_to_check" 2>&1)
  
  local HTTP_CODE=$(echo "$FULL_RESPONSE" | grep "__HTTP_STATUS" | cut -d: -f2)
  local BODY=$(echo "$FULL_RESPONSE" | sed '/__HTTP_STATUS/d')
  
  echo "  HTTP Status: $HTTP_CODE" | tee -a "$LOG_FILE"
  echo "  Response preview: $(echo "$BODY" | head -c 150)..." | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"
  
  # Check status code first
  if [ "$HTTP_CODE" != "200" ]; then
    echo -e "${RED}✗ FAILED: HTTP $HTTP_CODE (invalid query or access denied)${NC}" | tee -a "$LOG_FILE"
    echo "  Response body: $BODY" | tee -a "$LOG_FILE"
    ((CHECKS_FAILED++))
    return 1
  fi
  
  # Check if response is valid JSON and contains policies
  if echo "$BODY" | grep -qE '\[\s*\]'; then
    echo -e "${RED}✗ FAILED: No RLS policies found for $check_name table${NC}" | tee -a "$LOG_FILE"
    ((CHECKS_FAILED++))
    return 1
  fi
  
  # Check for policyname field (indicates policies exist)
  if echo "$BODY" | grep -q '"policyname"'; then
    echo -e "${GREEN}✓ $check_name table has RLS policies defined${NC}" | tee -a "$LOG_FILE"
    ((CHECKS_PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAILED: No policyname field in response for $check_name${NC}" | tee -a "$LOG_FILE"
    echo "  Likely cause: Endpoint not configured or policies truly missing" | tee -a "$LOG_FILE"
    ((CHECKS_FAILED++))
    return 1
  fi
}

# Query both tables
query_policies "manuscripts" "manuscripts"
query_policies "manuscript_chunks" "manuscript_chunks"

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
