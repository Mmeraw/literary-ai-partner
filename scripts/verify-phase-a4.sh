#!/bin/bash
# Verification script for Phase A.4 - Observability Dashboard
# Run this to verify the implementation

set -e

echo "== Phase A.4 Verification =="
echo ""

# Check files exist
echo "✓ Checking files..."
test -f lib/jobs/diagnostics.ts && echo "  ✓ lib/jobs/diagnostics.ts"
test -f app/api/admin/diagnostics/route.ts && echo "  ✓ app/api/admin/diagnostics/route.ts"
test -f app/admin/diagnostics/page.tsx && echo "  ✓ app/admin/diagnostics/page.tsx"
test -f docs/PHASE_A4_OBSERVABILITY.md && echo "  ✓ docs/PHASE_A4_OBSERVABILITY.md"
echo ""

# Check TypeScript compiles
echo "✓ Checking TypeScript compilation..."
npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "error TS" && echo "  ✗ TypeScript errors found" && exit 1 || echo "  ✓ No TypeScript errors"
echo ""

# Check build succeeds
echo "✓ Running production build..."
npm run build > /dev/null 2>&1 && echo "  ✓ Build successful" || (echo "  ✗ Build failed" && exit 1)
echo ""

echo "== Phase A.4 Verification Complete =="
echo ""
echo "To test the dashboard:"
echo "  1. npm run dev"
echo "  2. Visit http://localhost:3002/admin/diagnostics"
echo "  3. Or test API: curl http://localhost:3002/api/admin/diagnostics | jq"
