#!/usr/bin/env bash
# ADR-007 enforcement: no require() in server runtime paths
# See docs/ARCHITECTURE_DECISIONS/ADR-007-esm-dynamic-imports.md
set -e

echo "Checking for forbidden require() in server runtime..."

# Search app/ and lib/ for require() calls in .ts/.tsx files
# Exclude: test files, .bak/.orig files, node_modules
HITS=$(
  grep -rn 'require(' app/ lib/ \
    --include='*.ts' --include='*.tsx' \
    --exclude='*.test.ts' --exclude='*.test.tsx' \
    --exclude='*.bak' --exclude='*.orig' --exclude='*.rej' \
    | grep -v 'node_modules' \
    | grep -v '// .*require' \
    | grep -v 'eslint-disable' \
    || true
)

if [ -n "$HITS" ]; then
  echo "$HITS"
  echo ""
  echo "FAIL: require() detected in server runtime paths (app/, lib/)"
  echo "Use await import() instead. See ADR-007."
  exit 1
fi

echo "PASS: No forbidden require() usage in server runtime"
