#!/bin/bash
# Pre-Commit Secret Scanner
# 
# Purpose: Detect hardcoded secrets before they enter version control
# Usage: ./scripts/check-secrets.sh [--staged|--all]
#
# Returns: Exit code 1 if secrets detected, 0 if clean

set -e

MODE="${1:---staged}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Pre-Commit Secret Scanner ==="
echo "Mode: $MODE"
echo ""

# Patterns that indicate actual secret values (not just env var names)
SECRET_PATTERNS=(
  # JWT tokens (Supabase service role keys)
  'eyJ[A-Za-z0-9_-]{50,}'
  
  # Long hex strings (likely API keys)
  '["\047=][a-f0-9]{32,}["\047]'
  
  # Supabase project URLs with keys in query params
  'supabase\.co/.*[?&](apikey|key)=[a-zA-Z0-9_-]{20,}'
  
  # Explicit assignment of long strings to sensitive vars
  'ADMIN_API_KEY=["\047]?[a-f0-9]{32,}'
  'OPENAI_API_KEY=["\047]?sk-[a-zA-Z0-9]{32,}'
  'SERVICE_ROLE_KEY=["\047]?eyJ[A-Za-z0-9_-]{50,}'
)

# Get diff based on mode
if [ "$MODE" = "--staged" ]; then
  DIFF=$(git diff --cached)
  DESCRIPTION="staged changes"
elif [ "$MODE" = "--all" ]; then
  DIFF=$(git diff HEAD)
  DESCRIPTION="uncommitted changes"
else
  echo -e "${RED}❌ Invalid mode: $MODE${NC}"
  echo "Usage: $0 [--staged|--all]"
  exit 1
fi

if [ -z "$DIFF" ]; then
  echo -e "${GREEN}✅ No changes to scan${NC}"
  exit 0
fi

# Check each pattern
SECRETS_FOUND=0

for pattern in "${SECRET_PATTERNS[@]}"; do
  if echo "$DIFF" | grep -qE "$pattern"; then
    if [ $SECRETS_FOUND -eq 0 ]; then
      echo -e "${RED}🚨 SECRETS DETECTED IN $DESCRIPTION${NC}"
      echo ""
    fi
    
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
    
    # Show matching lines (but truncate long values for safety)
    echo -e "${RED}Pattern matched:${NC} $pattern"
    echo "$DIFF" | grep -E "$pattern" | head -3 | sed 's/eyJ[A-Za-z0-9_-]\{20,\}/eyJ***/g' | sed 's/[a-f0-9]\{32,\}/***/g'
    echo ""
  fi
done

if [ $SECRETS_FOUND -gt 0 ]; then
  echo -e "${RED}❌ Found $SECRETS_FOUND potential secret(s) in $DESCRIPTION${NC}"
  echo ""
  echo "Action required:"
  echo "1. Remove hardcoded secrets from code"
  echo "2. Use environment variables instead (process.env.SECRET_NAME)"
  echo "3. Ensure .env.local is in .gitignore"
  echo "4. If secrets were already committed, rotate them immediately"
  echo ""
  exit 1
else
  echo -e "${GREEN}✅ No secrets detected in $DESCRIPTION${NC}"
  echo ""
  echo "Note: This scanner checks for common patterns but isn't foolproof."
  echo "Always review your changes before committing."
  echo ""
  exit 0
fi
