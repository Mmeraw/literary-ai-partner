#!/usr/bin/env bash
set -euo pipefail

echo "Checking for forbidden require() in server runtime..."

# We only scan app/ and lib/ (not scripts/, not repo-wide).
# Exclusions:
# - test files
# - createRequire( and require.resolve(
# - any require() that is preceded by '.' (covers '.require(' patterns)
#
# Note: We intentionally flag plain `require(` usage.

matches="$(rg -n \
  --glob '!**/*.test.*' \
  --glob '!scripts/**' \
  '(?<!\.)\brequire\(' \
  app lib || true)"

# Filter out known allowed patterns that might still match:
matches="$(printf "%s\n" "$matches" \
  | rg -v 'createRequire\(' \
  | rg -v 'require\.resolve\(' \
  || true)"

if [[ -n "${matches}" ]]; then
  echo "❌ require() detected in server runtime:"
  echo "${matches}"
  exit 1
fi

echo "✅ No forbidden require() usage"
