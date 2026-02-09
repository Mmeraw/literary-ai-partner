#!/usr/bin/env bash
set -euo pipefail

echo "🔍 Canon Governance Audit Suite"
echo "================================"
echo ""

# 1. Criteria registry enforcement
echo "→ Criteria registry enforcement..."
node scripts/check-criteria-registry.js
echo ""

# 2. Nomenclature canon enforcement
echo "→ Nomenclature canon enforcement..."
node scripts/check-nomenclature-canon.js
echo ""

# 3. GPG disabled enforcement
echo "→ GPG disabled enforcement..."
node scripts/check-gpg-disabled.js
echo ""

# 4. Prompt/criteria banned-alias enforcement (context-aware)
echo "→ Prompt/criteria banned-alias enforcement..."
# Match banned aliases as criterion keys/values (string literals, object keys, array elements)
# Patterns: quoted strings, colon-prefixed, object/array contexts with banned criterion aliases
PATTERN='("(plot|structure|craft|stakes|clarity)"|'\''(plot|structure|craft|stakes|clarity)'\''|:\s*(plot|structure|craft|stakes|clarity)\b|key:\s*"(plot|structure|craft|stakes|clarity)"|[(,]\s*"(plot|structure|craft|stakes|clarity)")'

set +e
rg "$PATTERN" . \
  --glob '**/*.ts' \
  --glob '**/*.tsx' \
  --glob '**/*.js' \
  --glob '**/*.jsx' \
  --glob '!**/*.test.*' \
  --glob '!**/__tests__/**' \
  --glob '!**/archive/**' \
  --glob '!**/functions/**' \
  --glob '!**/*.md' \
  --glob '!**/node_modules/**' \
  --hidden \
  --line-number
RG_EXIT=$?
set -e

if [ "$RG_EXIT" -eq 0 ]; then
  echo ""
  echo "❌ Canon violation: banned alias found in prompt/criteria context."
  echo "   Fix: replace with canonical keys (e.g., narrativeDrive, sceneConstruction, proseControl) or remove non-canonical dimensions."
  exit 2
elif [ "$RG_EXIT" -eq 1 ]; then
  echo "✅ No banned aliases in prompt/criteria contexts."
  echo ""
else
  echo ""
  echo "❌ Canon Guard error: ripgrep failed (exit $RG_EXIT)."
  exit 2
fi

echo "✅ All canon audits PASSED"
