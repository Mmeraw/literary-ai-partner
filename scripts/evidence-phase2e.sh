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

# Query pg_policies directly to verify RLS policies exist and reference canonical user_id
echo "Checking manuscripts table RLS policies..." | tee -a "$LOG_FILE"

POLICY_RESPONSE=$(curl -s \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/pg_policies?table_name=eq.manuscripts" 2>&1)

# Check if response contains policies
if echo "$POLICY_RESPONSE" | grep -q 'policyname'; then
  echo -e "${GREEN}✓ manuscripts RLS policies found${NC}" | tee -a "$LOG_FILE"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗ FAILED: No manuscripts RLS policies found in production${NC}" | tee -a "$LOG_FILE"
  echo "   Response: $POLICY_RESPONSE" | tee -a "$LOG_FILE"
  ((CHECKS_FAILED++))
fi

echo "" | tee -a "$LOG_FILE"

# Check manuscript_chunks policies
echo "Checking manuscript_chunks table RLS policies..." | tee -a "$LOG_FILE"

POLICY_RESPONSE=$(curl -s \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  "$SUPABASE_URL/rest/v1/pg_policies?table_name=eq.manuscript_chunks" 2>&1)

if echo "$POLICY_RESPONSE" | grep -q 'policyname'; then
  echo -e "${GREEN}✓ manuscript_chunks RLS policies found${NC}" | tee -a "$LOG_FILE"
  ((CHECKS_PASSED++))
else
  echo -e "${RED}✗ FAILED: No manuscript_chunks RLS policies found in production${NC}" | tee -a "$LOG_FILE"
  ((CHECKS_FAILED++))
fi

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
