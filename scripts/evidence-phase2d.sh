#!/usr/bin/env bash
# Phase 2D: Slice 1 Evidence (Atomic claim + concurrency)
# Usage: bash scripts/evidence-phase2d.sh
# Output: Timestamped log in /tmp/phase2d-evidence-*.log

set -euo pipefail
IFS=$'\n\t'

# Prevent accidental sourcing
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  echo "❌ ERROR: This script must be executed, not sourced" >&2
  return 1
fi

# Navigate to repo root (works in CI and locally)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

LOG="/tmp/phase2d-evidence-$(date +%s).log"

# Error handler: print failing command before exit
trap 'echo "❌ FAILED at step: $BASH_COMMAND" >&2' ERR

require_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Missing required env: $var" >&2
    exit 1
  fi
}

{
  cat <<'EOF'
=========================================
PHASE 2D SLICE 1 EVIDENCE
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
0) Supabase env preflight
EOF
  require_env "SUPABASE_SERVICE_ROLE_KEY"
  if [[ -z "${SUPABASE_URL:-}" && -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
    echo "❌ Missing required env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" >&2
    exit 1
  fi
  echo "✅ Supabase env present"
  echo ""

  cat <<'EOF'
0a) Schema fingerprint
EOF
  echo "Required columns: worker_id, lease_token, lease_until, heartbeat_at, started_at"
  echo "Required RPC: claim_job_atomic(p_worker_id, p_now, p_lease_seconds)"
  echo "Required indexes: idx_evaluation_jobs_status_lease, idx_evaluation_jobs_worker_id"
  echo "✅ Schema documented (manual verification required)"
  echo ""

  cat <<'EOF'
1) TypeScript (main + workers)
EOF
  npx tsc --noEmit -p tsconfig.json || { echo "❌ TypeScript main config failed"; exit 1; }
  npx tsc --noEmit -p tsconfig.workers.json || { echo "❌ TypeScript worker config failed"; exit 1; }
  echo "✅ TS clean"
  echo ""

  cat <<'EOF'
2) Phase 2D-1 atomic claim concurrency
EOF
  npx jest phase2d1-atomic-claim-concurrency.test.ts --no-coverage || { echo "❌ Phase 2D-1 test failed"; exit 1; }
  echo ""

  cat <<'EOF'
=========================================
✅ PHASE 2D SLICE 1 LOCKED
=========================================
EOF
  echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} 2>&1 | tee "$LOG"

echo ""
echo "Evidence archived: $LOG"
echo "Total lines: $(wc -l < "$LOG")"
