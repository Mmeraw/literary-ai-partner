#!/usr/bin/env bash
# Drift Tripwire - Fails if banned patterns reappear in refactored scripts
# Run this in CI to prevent regression to manual duplication
#
# SCOPE POLICY:
# This script ONLY checks the 4 scripts listed below.
# 
# WHY ONLY 4 FILES?
# These are the "golden path" reference implementations that were refactored
# to use centralized helpers (_http.mjs, _skip.mjs). Other scripts in scripts/
# directory (e.g., jobs-load.mjs, jobs-validate-invariants.mjs, jobs-smoke-real.mjs)
# still contain manual duplication and are OUT OF SCOPE until refactored.
#
# ADDING NEW FILES:
# When you refactor additional scripts to use centralized helpers:
# 1. Add the script path to the FILES array below
# 2. Verify it imports from _http.mjs and _skip.mjs
# 3. Run: npm run verify:zero-drift
# 4. Commit the updated script + this file together
#
# DO NOT copy patterns from out-of-scope scripts. Always use these 4 as templates.

set -euo pipefail

# Refactored scripts that MUST use centralized helpers (see SCOPE POLICY above)
FILES=(
  "scripts/jobs-smoke.mjs"
  "scripts/jobs-smoke-phase2.mjs"
  "scripts/jobs-lease-contention-test.mjs"
  "scripts/jobs-test-cancel.mjs"
)

echo "🔍 Drift Tripwire: Checking 4 refactored smoke tests..."
echo "   Files: ${FILES[*]}"
echo ""

FAIL=0

# Check 1: No hardcoded x-user-id headers (all must use jfetch)
echo "[1/4] Checking for hardcoded auth headers..."
if rg -q "x-user-id" "${FILES[@]}" 2>/dev/null; then
  echo "      ❌ FAIL - Found hardcoded x-user-id headers:"
  rg -n "x-user-id" "${FILES[@]}" 2>/dev/null | head -10
  FAIL=1
else
  echo "      ✅ PASS"
fi
echo ""

# Check 2: No manual must() implementations (all must import from _http.mjs)
echo "[2/4] Checking for manual must() functions..."
if rg -q "^function must\b|^async function must\b" "${FILES[@]}" 2>/dev/null; then
  echo "      ❌ FAIL - Found manual must() implementations:"
  rg -n "^function must\b|^async function must\b" "${FILES[@]}" 2>/dev/null | head -10
  FAIL=1
else
  echo "      ✅ PASS"
fi
echo ""

# Check 3: No manual sleep() implementations (all must import from _http.mjs)
echo "[3/4] Checking for manual sleep() functions..."
if rg -q "^function sleep\b|^const sleep\s*=" "${FILES[@]}" 2>/dev/null; then
  echo "      ❌ FAIL - Found manual sleep() implementations:"
  rg -n "^function sleep\b|^const sleep\s*=" "${FILES[@]}" 2>/dev/null | head -10
  FAIL=1
else
  echo "      ✅ PASS"
fi
echo ""

# Check 4: No manual skip logic (all must use skipIfMemoryMode)
echo "[4/4] Checking for manual skip logic..."
if rg -q 'USE_SUPABASE_JOBS !== "false".*process\.exit\(0\)' "${FILES[@]}" 2>/dev/null; then
  echo "      ❌ FAIL - Found manual skip logic:"
  rg -n 'USE_SUPABASE_JOBS !== "false".*process\.exit\(0\)' "${FILES[@]}" 2>/dev/null | head -10
  FAIL=1
else
  echo "      ✅ PASS"
fi
echo ""

if [ $FAIL -eq 1 ]; then
  echo "════════════════════════════════════════════════════════"
  echo "❌ DRIFT DETECTED! Manual duplication has returned."
  echo "   Fix: Use centralized helpers from _http.mjs and _skip.mjs"
  echo "════════════════════════════════════════════════════════"
  exit 1
fi

echo "════════════════════════════════════════════════════════"
echo "✅ ALL TRIPWIRE CHECKS PASSED - NO DRIFT DETECTED"
echo "════════════════════════════════════════════════════════"
exit 0
