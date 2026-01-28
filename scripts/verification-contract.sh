#!/usr/bin/env bash
set -euo pipefail

# CANONICAL VERIFICATION CONTRACT
# Use this everywhere. Never deviate.

cd "$(git rev-parse --show-toplevel)"

# Verify ripgrep is available (contract requires it)
if ! command -v rg &> /dev/null; then
  echo "❌ FATAL: ripgrep (rg) not found on PATH"
  echo "   Install with one of these (platform-native preferred):"
  echo ""
  echo "   Ubuntu/Debian:"
  echo "     apt-get install ripgrep"
  echo ""
  echo "   macOS:"
  echo "     brew install ripgrep"
  echo ""
  echo "   Windows:"
  echo "     choco install ripgrep"
  echo "     or"
  echo "     scoop install ripgrep"
  echo ""
  echo "   Fallback (any platform, requires Rust):"
  echo "     cargo install ripgrep"
  exit 127
fi

echo "========== CANONICAL VERIFICATION CONTRACT =========="
echo

# Check A: Forbid misleading phrasing
PHRASING_PATTERN="\-\-staging vs \-\-prod"
echo "Check A: Forbid fictional staging/prod flag phrasing"
echo "  Command: rg -n '${PHRASING_PATTERN}' -S . --type-not=sh --type-not=md"
printf "  Result:  "
if rg -n "${PHRASING_PATTERN}" -S . --type-not=sh --type-not=md > /dev/null 2>&1; then
  echo "❌ FAIL"
  exit 1
else
  echo "✅ PASS (zero matches)"
fi
echo

# Check B: Forbid unlabeled commands (CANONICAL FILTER)
COMMAND_PATTERN="vercel deploy --staging"
ALLOWED_LABELS="(Old|incorrect|Before|Original|Documentation showed|Suggested|doesn't exist)"
echo "Check B: Forbid unlabeled ${COMMAND_PATTERN}"
echo "  Command: rg -n '${COMMAND_PATTERN}' -S . --type-not=sh --type-not=md | rg -v '${ALLOWED_LABELS}'"
printf "  Result:  "
if rg -n "${COMMAND_PATTERN}" -S . --type-not=sh --type-not=md | rg -v "${ALLOWED_LABELS}" > /dev/null 2>&1; then
  echo "❌ FAIL (unlabeled found)"
  exit 1
else
  echo "✅ PASS (all labeled)"
fi
echo

echo "========== CONTRACT LOCKED ✅ =========="

