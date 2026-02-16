#!/usr/bin/env bash
set -euo pipefail

echo "Checking for forbidden require() in server runtime..."

# We only scan app/ and lib/ (not scripts/, not repo-wide).
# Exclusions:
# - test files (*.test.*)
# - createRequire( and require.resolve(
# - any require() preceded by '.' (e.g. module.require)
#
# Uses grep -rP (PCRE) available on ubuntu-latest.
# rg is preferred but not guaranteed in CI.

if command -v rg &>/dev/null; then
  matches="$(rg -n \
    --glob '!**/*.test.*' \
    --glob '!scripts/**' \
    '(?<!\.)\brequire\(' \
    app lib || true)"

  # Filter out known allowed patterns:
  matches="$(printf "%s\n" "$matches" \
    | rg -v 'createRequire\(' \
    | rg -v 'require\.resolve\(' \
    || true)"
else
  echo "  (rg not found, falling back to grep -rP)"
  matches="$(grep -rPn \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --exclude-dir='node_modules' \
    '(?<!\.)\brequire\(' \
    app lib 2>/dev/null || true)"

  # Exclude test files and known allowed patterns:
  matches="$(printf "%s\n" "$matches" \
    | grep -v '\.test\.' \
    | grep -v 'createRequire(' \
    | grep -v 'require\.resolve(' \
    || true)"
fi

if [[ -n "${matches}" ]]; then
  echo "❌ require() detected in server runtime:"
  echo "${matches}"
  exit 1
fi

echo "✅ No forbidden require() usage"
