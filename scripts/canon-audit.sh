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

echo "✅ All canon audits PASSED"
