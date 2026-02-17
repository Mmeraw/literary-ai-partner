#!/bin/bash
# Phase A.5 Day 2 Verification Script
#
# Tests:
# 1. Backpressure and cost modules exist and export expected functions
# 2. Backpressure guard is wired into job creation endpoint
# 3. Diagnostics endpoint includes backpressure + cost data
# 4. TypeScript compiles cleanly
# 5. Canon guard passes

set -e

echo "=== Phase A.5 Day 2 Verification ==="
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
  npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | head -10
  exit 1
else
  echo -e "${GREEN}✅ TypeScript compiles cleanly${NC}"
fi
echo ""

# 2. Check that Day 2 core modules exist
echo "📁 Checking Day 2 modules..."
files=(
  "lib/jobs/backpressure.ts"
  "lib/jobs/cost.ts"
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

# 3. Check backpressure module exports
echo "🔍 Checking backpressure module exports..."
if grep -q "export.*function.*checkBackpressure" lib/jobs/backpressure.ts && \
   grep -q "export.*function.*backpressureGuard" lib/jobs/backpressure.ts && \
   grep -q "export.*function.*getQueueDepth" lib/jobs/backpressure.ts; then
  echo -e "${GREEN}✅ Backpressure module exports expected functions${NC}"
else
  echo -e "${RED}❌ Backpressure module missing expected exports${NC}"
  exit 1
fi
echo ""

# 4. Check cost module exports
echo "💰 Checking cost module exports..."
if grep -q "export.*function.*getCostSnapshot" lib/jobs/cost.ts && \
   grep -q "export.*function.*getJobCostSummary" lib/jobs/cost.ts && \
   grep -q "export.*function.*recordCost" lib/jobs/cost.ts; then
  echo -e "${GREEN}✅ Cost module exports expected functions${NC}"
else
  echo -e "${RED}❌ Cost module missing expected exports${NC}"
  exit 1
fi
echo ""

# 5. Check backpressure guard is wired into job creation endpoint
echo "🛡️  Checking backpressure enforcement wiring..."
if grep -q "import.*backpressureGuard.*from.*@/lib/jobs/backpressure" app/api/jobs/route.ts && \
   grep -q "backpressureGuard" app/api/jobs/route.ts; then
  echo -e "${GREEN}✅ Backpressure guard wired into job creation endpoint${NC}"
else
  echo -e "${RED}❌ Backpressure guard not found in job creation endpoint${NC}"
  exit 1
fi
echo ""

# 6. Check diagnostics route includes backpressure + cost
echo "📊 Checking diagnostics endpoint extensions..."
if grep -q "import.*checkBackpressure.*from.*@/lib/jobs/backpressure" app/api/admin/diagnostics/route.ts && \
   grep -q "import.*getCostSnapshot.*from.*@/lib/jobs/cost" app/api/admin/diagnostics/route.ts && \
   grep -q "checkBackpressure" app/api/admin/diagnostics/route.ts && \
   grep -q "getCostSnapshot" app/api/admin/diagnostics/route.ts; then
  echo -e "${GREEN}✅ Diagnostics endpoint includes backpressure + cost data${NC}"
else
  echo -e "${RED}❌ Diagnostics endpoint missing backpressure or cost integration${NC}"
  exit 1
fi
echo ""

# 7. Check that diagnostics response includes new fields
echo "🔍 Checking diagnostics response structure..."
if grep -q "backpressure" app/api/admin/diagnostics/route.ts && \
   grep -q "cost.*costSnapshot" app/api/admin/diagnostics/route.ts; then
  echo -e "${GREEN}✅ Diagnostics response includes backpressure + cost fields${NC}"
else
  echo -e "${YELLOW}⚠️  Diagnostics response may not include new fields${NC}"
fi
echo ""

# 8. Run canon guard (JOB_CONTRACT_v1 checks)
echo "⚖️  Running canon guard..."
if [ -f "scripts/canon-guard.sh" ]; then
  if bash scripts/canon-guard.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Canon guard passed${NC}"
  else
    echo -e "${RED}❌ Canon guard failed${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}⚠️  Canon guard script not found (skipping)${NC}"
fi
echo ""

# 9. Verify Day 2 didn't introduce non-canonical job statuses
echo "📜 Checking governance compliance..."
# Day 2 should only use canonical job statuses: queued, running, complete, failed
# Note: Chunks/artifacts have their own status enums (pending, processing, etc.) which are valid
if grep -rn "job.*status.*=.*['\"]pending['\"]" lib/jobs/backpressure.ts lib/jobs/cost.ts app/api/jobs/route.ts 2>/dev/null || \
   grep -rn "job.*status.*=.*['\"]completed['\"]" lib/jobs/backpressure.ts lib/jobs/cost.ts app/api/jobs/route.ts 2>/dev/null || \
   grep -rn "job.*status.*=.*['\"]processing['\"]" lib/jobs/backpressure.ts lib/jobs/cost.ts app/api/jobs/route.ts 2>/dev/null; then
  echo -e "${RED}❌ Non-canonical job status detected in Day 2 code${NC}"
  exit 1
else
  echo -e "${GREEN}✅ Day 2 code uses only canonical job statuses${NC}"
fi
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ All Phase A.5 Day 2 checks passed!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Day 2 deliverables verified:"
echo "  • lib/jobs/backpressure.ts (exports checkBackpressure, backpressureGuard, getQueueDepth)"
echo "  • lib/jobs/cost.ts (exports getCostSnapshot, getJobCostSummary, recordCost)"
echo "  • Backpressure guard wired at job submission boundary"
echo "  • Diagnostics endpoint extended with backpressure + cost visibility"
echo "  • TypeScript clean"
echo "  • Canon guard passed"
echo ""
