#!/usr/bin/env bash
# Drift Tripwire - Fails if banned patterns reappear in refactored scripts
# Run this in CI to prevent regression to manual duplication
# Only checks the 4 scripts that were refactored to use helpers

set -e

# Refactored scripts that MUST use centralized helpers
REFACTORED=(
  "scripts/jobs-smoke.mjs"
  "scripts/jobs-smoke-phase2.mjs"
  "scripts/jobs-lease-contention-test.mjs"
  "scripts/jobs-test-cancel.mjs"
)

echo "🔍 Drift Tripwire: Checking 4 refactored smoke tests..."

FAIL=0

# Check 1: No hardcoded x-user-id headers (all must use jfetch)
echo -n "  [1/4] Checking for hardcoded auth headers... "
if rg -q "x-user-id" "${REFACTORED[@]}" 2>/dev/null; then
  echo "❌ FAIL"
  echo "      Found hardcoded x-user-id headers:"
  rg -n "x-user-id" "${REFACTORED[@]}"
  FAIL=1
else
  echo "✅ PASS"
fi

# Check 2: No manual must() implementations (all must import from _http.mjs)
echo -n "  [2/4] Checking for manual must() functions... "
if rg -q "^function must\b|^async function must\b" "${REFACTORED[@]}" 2>/dev/null; then
  echo "❌ FAIL"
  echo "      Found manual must() implementations:"
  rg -n "^function must\b|^async function must\b" "${REFACTORED[@]}"
  FAIL=1
else
  echo "✅ PASS"
fi

# Check 3: No manual sleep() implementations (all must import from _http.mjs)
echo -n "  [3/4] Checking for manual sleep() functions... "
if rg -q "^function sleep\b|^const sleep\s*=" "${REFACTORED[@]}" 2>/dev/null; then
  echo "❌ FAIL"
  echo "      Found manual sleep() implementations:"
  rg -n "^function sleep\b|^const sleep\s*=" "${REFACTORED[@]}"
  FAIL=1
else
  echo "✅ PASS"
fi

# Check 4: No manual skip logic (all must use skipIfMemoryMode)
echo -n "  [4/4] Checking for manual skip logic... "
if rg -q 'USE_SUPABASE_JOBS !== "false".*process\.exit\(0\)' "${REFACTORED[@]}" 2>/dev/null; then
  echo "❌ FAIL"
  echo "      Found manual skip logic:"
  rg -n 'USE_SUPABASE_JOBS !== "false".*process\.exit\(0\)' "${REFACTORED[@]}"
  FAIL=1
else
  echo "✅ PASS"
fi

if [ $FAIL -eq 1 ]; then
  echo ""
  echo "❌ Drift detected! Manual duplication has returned."
  echo "   Fix: Use centralized helpers from _http.mjs and _skip.mjs"
  exit 1
fi

echo ""
echo "✅ All tripwire checks passed - no drift detected"
exit 0
