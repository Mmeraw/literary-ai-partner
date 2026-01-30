#!/bin/bash
# Safe Environment Variable Inspector
# 
# Purpose: Inspect .env.local presence without exposing secret values
# Usage: ./scripts/print-env-safe.sh [env-file]

set -e

ENV_FILE="${1:-.env.local}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=== Safe Environment Variable Inspector ==="
echo "File: $ENV_FILE"
echo ""

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ File not found: $ENV_FILE${NC}"
  exit 1
fi

# Key variables to check
VARS=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "ADMIN_API_KEY"
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "OPENAI_API_KEY"
)

echo "Checking for required environment variables..."
echo ""

for var in "${VARS[@]}"; do
  if grep -q "^${var}=" "$ENV_FILE"; then
    # Extract and sanitize value
    VALUE=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
    VALUE_LENGTH=${#VALUE}
    
    # Show first 8 chars only (or fewer if shorter)
    if [ $VALUE_LENGTH -gt 8 ]; then
      PREVIEW="${VALUE:0:8}..."
      echo -e "${GREEN}✅${NC} $var (${VALUE_LENGTH} chars): $PREVIEW"
    elif [ $VALUE_LENGTH -gt 0 ]; then
      echo -e "${GREEN}✅${NC} $var (${VALUE_LENGTH} chars): ***"
    else
      echo -e "${YELLOW}⚠️${NC}  $var (empty)"
    fi
  else
    echo -e "${RED}❌${NC} $var (missing)"
  fi
done

echo ""
echo "=== Production Safety Checks ==="

# Check for prod URL in use
SUPABASE_URL=$(grep "^SUPABASE_URL=" "$ENV_FILE" | cut -d'=' -f2- || echo "")
if echo "$SUPABASE_URL" | grep -q "xtumxjnzdswuumndcbwc"; then
  echo -e "${YELLOW}⚠️  WARNING: SUPABASE_URL points to PRODUCTION (xtumxjnzdswuumndcbwc)${NC}"
  echo "   If NODE_ENV=development, server will refuse to start (dev→prod guard)"
else
  echo -e "${GREEN}✅${NC} SUPABASE_URL points to non-production environment"
fi

echo ""
echo "=== Security Notes ==="
echo "- Never print full secret values to console/logs"
echo "- Use this script instead of 'grep .env.local' or 'cat .env.local'"
echo "- Rotate keys immediately if exposed in logs/screenshots"
echo ""
