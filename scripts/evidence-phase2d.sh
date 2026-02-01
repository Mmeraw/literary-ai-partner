#!/usr/bin/env bash
# Phase 2D: Slices 1-3 Evidence (Atomic claim + idempotency + reconciler)
# Usage: bash scripts/evidence-phase2d.sh
# Output: Timestamped log in /tmp/phase2d-evidence-*.log
# Note: Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

set -euo pipefail
IFS=$'\n\t'

# Prevent accidental sourcing
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  echo "❌ ERROR: This script must be executed, not sourced" >&2
  return 1
fi

# CRITICAL: Only export if not already set (preserve workflow env vars)
# DO NOT override with empty defaults - that wipes CI secrets!
export SUPABASE_URL="${SUPABASE_URL:-}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
export SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

# Guard: Fail fast if service_role key is missing
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
  echo "❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required for Phase 2D tests" >&2
  echo "   Tests need service_role to create manuscripts and evaluation jobs" >&2
  echo "   Set it via workflow secrets or local .env" >&2
  exit 1
fi

# Navigate to repo root (works in CI and locally)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

LOG="/tmp/phase2d-evidence-$(date +%s).log"

require_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Missing required env: $var" >&2
    exit 1
  fi
}

# Redirect all output to both console and log file
exec > >(tee -a "$LOG") 2>&1

# Error handler: print failing command before exit
trap 'echo "❌ FAILED at line $LINENO: $BASH_COMMAND" >&2' ERR

{
  cat <<'EOF'
=========================================
PHASE 2D SLICES 1–3 EVIDENCE
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
  
  # Validate URL format (must be http(s)://...)
  URL_TO_CHECK="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL}}"
  if [[ ! "${URL_TO_CHECK}" =~ ^https?:// ]]; then
    echo "❌ SUPABASE_URL is invalid: '${URL_TO_CHECK}'" >&2
    echo "   Must start with http:// or https://" >&2
    echo "   Example: https://your-project.supabase.co" >&2
    exit 1
  fi
  
  echo "✅ Supabase env present (URL: ${URL_TO_CHECK})"
  echo ""

  cat <<'EOF'
0b) Key fingerprint (ref match check)
EOF
  # DEBUG: Print key lengths to verify they're set (without leaking values)
  echo "DEBUG: service_role key length = ${#SUPABASE_SERVICE_ROLE_KEY}"
  ANON_KEY_VAR="${SUPABASE_ANON_KEY:-}"
  echo "DEBUG: anon key length = ${#ANON_KEY_VAR}"
  echo "DEBUG: service_role first 30 chars = ${SUPABASE_SERVICE_ROLE_KEY:0:30}..."
  echo ""
  
  # Decode JWT refs to verify URL and keys are from same project
  node - <<'NODEEOF'
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64').toString('utf8');
}

function jwtRef(jwt) {
  if (!jwt || typeof jwt !== 'string') return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(b64urlDecode(parts[1]));
    return payload.ref || null;
  } catch {
    return null;
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const urlRef = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || null;

const serviceRef = jwtRef(process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonRef = jwtRef(process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

console.log("URL project ref:            " + (urlRef || "(none)"));
console.log("Service role key ref:       " + (serviceRef || "(none)"));
console.log("Anon key ref:               " + (anonRef || "(none)"));

if (urlRef && serviceRef && urlRef !== serviceRef) {
  console.error("\n❌ MISMATCH: SUPABASE_URL project ref (" + urlRef + ") does not match SUPABASE_SERVICE_ROLE_KEY ref (" + serviceRef + ")");
  console.error("   → SUPABASE_SERVICE_ROLE_KEY is for a DIFFERENT Supabase project");
  process.exit(2);
}
if (urlRef && anonRef && urlRef !== anonRef) {
  console.error("\n❌ MISMATCH: SUPABASE_URL project ref (" + urlRef + ") does not match SUPABASE_ANON_KEY ref (" + anonRef + ")");
  console.error("   → SUPABASE_ANON_KEY is for a DIFFERENT Supabase project");
  process.exit(2);
}
console.log("✅ All key refs match URL project ref");
NODEEOF
  echo ""

  cat <<'EOF'
0c) Schema fingerprint
EOF
  echo "Required columns: worker_id, lease_token, lease_until, heartbeat_at, started_at"
  echo "Required RPC: claim_job_atomic(p_worker_id, p_now, p_lease_seconds)"
  echo "Required RPC: renew_lease(p_job_id, p_worker_id, p_lease_token, p_now, p_lease_seconds)"
  echo "Required indexes: idx_evaluation_jobs_status_lease, idx_evaluation_jobs_worker_id"
  echo "Required constraint: unique_provider_call_per_job (job_id, provider, phase)"
  echo ""
  echo "Git commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
  echo "Migration anchor: Latest applied migration (verify via Supabase dashboard)"
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
3) Phase 2D-2 idempotency proof
EOF
  npx jest phase2d2-idempotency-proof.test.ts --no-coverage || { echo "❌ Phase 2D-2 test failed"; exit 1; }
  echo ""

  cat <<'EOF'
4) Phase 2D-3 reconciler proof
EOF
  npx jest phase2d3-reconciler-proof.test.ts --no-coverage || { echo "❌ Phase 2D-3 test failed"; exit 1; }
  echo ""

  cat <<'EOF'
=========================================
✅ PHASE 2D SLICES 1–3 LOCKED
=========================================
EOF
  echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

echo ""
echo "Evidence archived: $LOG"
echo "Total lines: $(wc -l < "$LOG")"
