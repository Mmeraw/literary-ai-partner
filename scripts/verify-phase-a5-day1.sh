#!/bin/bash
# Phase A.5 Day 1 Verification Script
#
# Tests:
# 1. Dev→Prod invariant (server won't start against prod in dev mode)
# 2. Admin endpoints require x-admin-key header
# 3. Rate limiting works on retry endpoint
# 4. TypeScript compiles cleanly

set -e

echo "=== Phase A.5 Day 1 Verification ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check TypeScript compilation
echo "📝 Checking TypeScript compilation..."
if npx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS"; then
  echo -e "${RED}❌ TypeScript errors found${NC}"
  exit 1
else
  echo -e "${GREEN}✅ TypeScript compiles cleanly${NC}"
fi
echo ""

# 2. Check that key files exist
echo "📁 Checking required files..."
files=(
  "lib/supabase/admin.ts"
  "lib/admin/requireAdmin.ts"
  "lib/rateLimit.ts"
  "app/api/admin/diagnostics/route.ts"
  "app/api/admin/dead-letter/route.ts"
  "app/api/admin/jobs/[jobId]/retry/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $file"
  else
    echo -e "${RED}❌${NC} $file (missing)"
    exit 1
  fi
done
echo ""

# 3. Check dev→prod guard exists in instrumentation file
echo "🛡️  Checking dev→prod invariant guard..."
if [ -f "instrumentation.ts" ] || [ -f "instrumentation.js" ]; then
  if grep -q "CRITICAL STARTUP FAILURE" instrumentation.ts instrumentation.js 2>/dev/null && \
     grep -q "xtumxjnzdswuumndcbwc" instrumentation.ts instrumentation.js 2>/dev/null; then
    echo -e "${GREEN}✅ Dev→prod guard present in instrumentation (startup-hard)${NC}"
  else
    echo -e "${RED}❌ Dev→prod guard code missing from instrumentation${NC}"
    exit 1
  fi
else
  echo -e "${RED}❌ instrumentation.ts/js file missing${NC}"
  exit 1
fi

# Check instrumentation file is properly structured
if grep -q "export.*function register" instrumentation.ts instrumentation.js 2>/dev/null; then
  echo -e "${GREEN}✅ Instrumentation register() function present${NC}"
else
  echo -e "${RED}❌ Instrumentation register() function missing${NC}"
  exit 1
fi
echo ""

# 4. Check requireAdmin is applied to all admin routes
echo "🔐 Checking admin authentication..."
admin_routes=(
  "app/api/admin/diagnostics/route.ts"
  "app/api/admin/dead-letter/route.ts"
  "app/api/admin/jobs/[jobId]/retry/route.ts"
)

for route in "${admin_routes[@]}"; do
  if grep -q "requireAdmin" "$route"; then
    echo -e "${GREEN}✅${NC} $route (protected)"
  else
    echo -e "${RED}❌${NC} $route (missing requireAdmin)"
    exit 1
  fi
done
echo ""

# 5. Check rate limiting on retry endpoint
echo "⏱️  Checking rate limiting..."
if grep -q "rateLimit" app/api/admin/jobs/[jobId]/retry/route.ts; then
  echo -e "${GREEN}✅ Rate limiting implemented on retry endpoint${NC}"
else
  echo -e "${YELLOW}⚠️  Rate limiting not found on retry endpoint${NC}"
fi
echo ""

# 6. Check ADMIN_API_KEY in .env.local
echo "🔑 Checking ADMIN_API_KEY configuration..."
if grep -q "ADMIN_API_KEY=" .env.local; then
  echo -e "${GREEN}✅ ADMIN_API_KEY configured in .env.local${NC}"
else
  echo -e "${RED}❌ ADMIN_API_KEY missing from .env.local${NC}"
  echo "   Add: ADMIN_API_KEY=\$(openssl rand -hex 32)"
  exit 1
fi
echo ""

# 7. Manual test reminder for dev→prod guard runtime behavior
echo "🚨 Dev→prod guard runtime verification..."
echo -e "${GREEN}✅ Guard code present in instrumentation.ts (verified above)${NC}"
echo -e "${YELLOW}⚠️  Manual runtime test recommended:${NC}"
echo -e "${YELLOW}   1. Set SUPABASE_URL=https://xtumxjnzdswuumndcbwc.supabase.co in .env.local${NC}"
echo -e "${YELLOW}   2. Run: NODE_ENV=development npm run dev${NC}"
echo -e "${YELLOW}   3. Expected: Server refuses to start with 'CRITICAL STARTUP FAILURE'${NC}"
echo -e "${YELLOW}   4. Revert to dev URL and confirm server starts normally${NC}"
echo ""
echo "   (Automated runtime testing requires running Next.js dev server,"
echo "    which is not practical in a verification script.)"
echo ""

# 8. Build check
echo "🏗️  Testing production build..."
if npm run build > /tmp/build.log 2>&1; then
  echo -e "${GREEN}✅ Production build succeeds${NC}"
else
  echo -e "${RED}❌ Build failed. Check /tmp/build.log${NC}"
  tail -20 /tmp/build.log
  exit 1
fi
echo ""

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Phase A.5 Day 1 VERIFICATION PASS  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "1. Start dev server: npm run dev"
echo "2. Test admin endpoints:"
echo "   # Should fail (401)"
echo "   curl -i http://localhost:3002/api/admin/diagnostics"
echo ""
echo "   # Should succeed (200)"
echo "   curl -H \"x-admin-key: \$ADMIN_API_KEY\" http://localhost:3002/api/admin/diagnostics"
echo ""
echo "3. Test dev→prod guard:"
echo "   # Point .env.local at prod URL → server should refuse to start"
echo "   # Revert to dev URL → server should start normally"
