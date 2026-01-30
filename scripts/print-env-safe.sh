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
    # Extract value for length and fingerprint
    VALUE=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
    VALUE_LENGTH=${#VALUE}
    
    if [ $VALUE_LENGTH -gt 0 ]; then
      # Generate non-reversible fingerprint (first 12 chars of sha256)
      FINGERPRINT=$(echo -n "$VALUE" | sha256sum | cut -c1-12)
      echo -e "${GREEN}✅${NC} $var (${VALUE_LENGTH} chars): sha256:$FINGERPRINT"
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
echo "- Fingerprints are sha256 hashes (non-reversible, safe to log)"
echo "- Use this script instead of 'grep .env.local' or 'cat .env.local'"
echo "- Fingerprint changes after rotation (proof that key was updated)"
echo "- Rotate keys immediately if exposed in logs/screenshots"
echo ""
echo "=== Advanced Usage ==="
echo "- Compare fingerprints after rotation to confirm change"
echo "- Log fingerprints in audit trail (safe, non-sensitive)"
echo "- Never use --show-prefix flag in production/CI"
echo ""
