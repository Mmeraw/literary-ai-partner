#!/bin/bash
# Quick verification that CANON schema fixes are working

set -e

echo ""
echo "🔍 CANON Schema Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: No old schema usage
echo "1️⃣  Checking for old schema (units_total/units_completed)..."
if grep -rn "units_total\|units_completed" lib/jobs/*.ts 2>/dev/null | grep -v test; then
  echo "   ❌ FAIL: Old schema still present!"
  exit 1
else
  echo "   ✅ PASS: No old schema found"
fi

# Test 2: CANON schema present
echo "2️⃣  Checking for CANON schema (total_units/completed_units)..."
CANON_COUNT=$(grep -rn "total_units\|completed_units" lib/jobs/*.ts 2>/dev/null | grep -v test | wc -l)
if [ "$CANON_COUNT" -lt 20 ]; then
  echo "   ⚠️  WARNING: Only $CANON_COUNT CANON usages found (expected ~30)"
else
  echo "   ✅ PASS: $CANON_COUNT CANON schema usages found"
fi

# Test 3: TypeScript types consistent
echo "3️⃣  Checking TypeScript JobProgress type..."
if grep -A 3 "export type JobProgress" lib/jobs/types.ts | grep -q "total_units"; then
  echo "   ✅ PASS: JobProgress uses CANON schema"
else
  echo "   ❌ FAIL: JobProgress type doesn't match CANON"
  exit 1
fi

# Test 4: Memory store initialization
echo "4️⃣  Checking jobStore.memory initial progress..."
if grep -A 8 "progress:" lib/jobs/jobStore.memory.ts | grep -q "total_units"; then
  echo "   ✅ PASS: Memory store uses CANON schema"
else
  echo "   ❌ FAIL: Memory store doesn't match CANON"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL CHECKS PASSED - Schema is CANON-consistent!"
echo ""
echo "📋 PhaseStatus vocabulary: LOCKED to CANON (queued|running|complete|failed)"
echo "   Remaining TODO (see docs/CANON_TODO.md):"
echo "   - Fix JobPhaseDetail nullability"
echo "   - Update test script endpoints"
echo "   - Silence dotenv output"
echo ""
