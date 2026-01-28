#!/usr/bin/env bash
# Phase 2C: Canonical Evidence Command
# Usage: bash scripts/evidence-phase2c.sh
# Output: Timestamped log in /tmp/phase2c-evidence-*.log
# Safety: Cannot be sourced; full error tracing

set -euo pipefail
IFS=$'\n\t'

# Prevent accidental sourcing
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  echo "❌ ERROR: This script must be executed, not sourced" >&2
  return 1
fi

cd /workspaces/literary-ai-partner

LOG="/tmp/phase2c-evidence-$(date +%s).log"

# Error handler: print failing command before exit
trap 'echo "❌ FAILED at step: $BASH_COMMAND" >&2' ERR

{
  cat <<'EOF'
=========================================
PHASE 2C COMBINED EVIDENCE
=========================================
EOF
  
  echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo ""
  
  cat <<'EOF'
Environment:
EOF
  echo "  Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
  echo "  Git commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
  echo "  Node version: $(node --version)"
  echo "  npm version: $(npm --version)"
  echo ""
  
  cat <<'EOF'
1) TypeScript (main + workers)
EOF
  npx tsc --noEmit -p tsconfig.json || { echo "❌ TypeScript main config failed"; exit 1; }
  npx tsc --noEmit -p tsconfig.workers.json || { echo "❌ TypeScript worker config failed"; exit 1; }
  echo "✅ TS clean"
  echo ""
  
  cat <<'EOF'
2) Phase 2C-1 runtime proof
EOF
  npx jest phase2c1-runtime-proof.test.ts --no-coverage || { echo "❌ Phase 2C-1 tests failed"; exit 1; }
  echo ""
  
  cat <<'EOF'
3) Phase 2C-4 persistence proof
EOF
  npx jest phase2c4-persistence.test.ts --no-coverage || { echo "❌ Phase 2C-4 tests failed"; exit 1; }
  echo ""
  
  cat <<'EOF'
=========================================
✅ PHASE 2C LOCKED
=========================================
EOF
  echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} 2>&1 | tee "$LOG"

echo ""
echo "Evidence archived: $LOG"
echo "Total lines: $(wc -l < "$LOG")"
