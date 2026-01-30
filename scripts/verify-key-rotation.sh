#!/bin/bash
# Service Role Key Rotation Verification
# 
# Purpose: Verify new Supabase service role key works correctly
# Usage: ./scripts/verify-key-rotation.sh

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== Service Role Key Rotation Verification ==="
echo ""

# Load environment
if [ ! -f .env.local ]; then
  echo -e "${RED}❌ .env.local not found${NC}"
  exit 1
fi

source .env.local

# Check key is set
if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}❌ SUPABASE_SERVICE_ROLE_KEY not set in .env.local${NC}"
  exit 1
fi

if [ -z "$SUPABASE_URL" ]; then
  echo -e "${RED}❌ SUPABASE_URL not set in .env.local${NC}"
  exit 1
fi

# Check key format (should start with eyJ for JWT)
if [[ ! "$SUPABASE_SERVICE_ROLE_KEY" =~ ^eyJ ]]; then
  echo -e "${YELLOW}⚠️  Warning: Service role key doesn't look like a JWT (should start with 'eyJ')${NC}"
fi

echo "1. Testing Supabase connection with new service role key..."

# Test basic connection (try to access REST API root)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  "${SUPABASE_URL}/rest/v1/")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
  echo -e "${GREEN}✅ Service role key authenticated successfully (HTTP $HTTP_CODE)${NC}"
else
  echo -e "${RED}❌ Service role key authentication failed (HTTP $HTTP_CODE)${NC}"
  echo "   This may indicate:"
  echo "   - Key not yet rotated in Supabase dashboard"
  echo "   - Wrong key copied to .env.local"
  echo "   - Network/connectivity issue"
  exit 1
fi

echo ""
echo "2. Testing admin client initialization..."

# Quick TypeScript compilation check
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
  echo -e "${RED}❌ TypeScript compilation errors${NC}"
  exit 1
else
  echo -e "${GREEN}✅ TypeScript compiles cleanly${NC}"
fi

echo ""
echo "3. Checking dev→prod guard status..."

# Check if we're pointing at prod
if echo "$SUPABASE_URL" | grep -q "xtumxjnzdswuumndcbwc"; then
  echo -e "${YELLOW}⚠️  Currently pointing at PRODUCTION Supabase${NC}"
  echo "   (Dev server will refuse to start if NODE_ENV=development)"
else
  echo -e "${GREEN}✅ Pointing at non-production Supabase${NC}"
fi

echo ""
echo "=== Rotation Verification Complete ==="
echo ""
echo "Next steps:"
echo "1. Start dev server: npm run dev"
echo "2. Test admin endpoints:"
echo "   curl -H \"x-admin-key: \$ADMIN_API_KEY\" http://localhost:3002/api/admin/diagnostics"
echo ""
echo "3. Update docs/SECURITY_REMEDIATION_2026-01-30.md with completion timestamp"
echo ""
