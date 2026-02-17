#!/usr/bin/env bash
# Gate A7 Evidence Verification Script
# Proves share link creation + anon view + revoke + fail-closed 404 behavior.
# Mirrors Flow 1 evidence harness style (x-user-id actor header, no cookie sessions).
# Usage: bash scripts/evidence-a7.sh

set -euo pipefail
IFS=$'\n\t'

if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
  echo "❌ ERROR: This script must be executed, not sourced" >&2
  return 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Load .env then .env.local (same precedence as Flow 1)
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env"
  set +a
fi
if [[ -f "$REPO_ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env.local"
  set +a
fi

LOG="/tmp/a7-evidence-$(date +%s).log"
exec > >(tee -a "$LOG") 2>&1

OWNER_ID="${FLOW1_OWNER_ID:-00000000-0000-0000-0000-000000000001}"
OTHER_ID="${FLOW1_OTHER_ID:-00000000-0000-0000-0000-000000000099}"
BASE_URL="${FLOW1_BASE_URL:-http://127.0.0.1:3002}"
START_SERVER="${FLOW1_START_SERVER:-1}"
SERVER_MODE="${FLOW1_SERVER_MODE:-dev}"
SERVER_LOG="/tmp/a7-next-$(date +%s).log"

NEXT_PID=""
cleanup() {
  if [[ -n "$NEXT_PID" ]] && kill -0 "$NEXT_PID" >/dev/null 2>&1; then
    kill "$NEXT_PID" >/dev/null 2>&1 || true
    wait "$NEXT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

require_env() {
  local var="$1"
  if [[ -z "${!var:-}" ]]; then
    echo "❌ Missing required env: $var" >&2
    exit 1
  fi
}

echo "========================================="
echo "GATE A7 EVIDENCE"
echo "========================================="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Repo: $REPO_ROOT"
echo "Commit: $(git rev-parse HEAD 2>/dev/null || echo unknown)"
echo "BASE_URL: $BASE_URL"
echo "SERVER_MODE: $SERVER_MODE"
echo ""

echo "0) Environment preflight"
require_env "SUPABASE_SERVICE_ROLE_KEY"
if [[ -z "${SUPABASE_URL:-}" && -z "${NEXT_PUBLIC_SUPABASE_URL:-}" ]]; then
  echo "❌ Missing required env: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" >&2
  exit 1
fi
export SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL}}"
echo "✅ Required env present"

echo ""
echo "1) Ensure API is reachable"
HEALTH_HTTP=$(curl -s -o /tmp/a7-health.json -w "%{http_code}" "$BASE_URL/api/health" || true)
if [[ "$HEALTH_HTTP" != "200" ]]; then
  if [[ "$START_SERVER" != "1" ]]; then
    echo "❌ API unavailable at $BASE_URL and FLOW1_START_SERVER=$START_SERVER" >&2
    exit 1
  fi

  if [[ "$SERVER_MODE" == "prod" ]]; then
    echo "Health check not ready; building + starting Next production server..."
    export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-https://placeholder.supabase.co}}"
    export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-placeholder-key-for-build}}"
    if ! npm run build > "$SERVER_LOG" 2>&1; then
      echo "❌ Production build failed during evidence startup"
      tail -n 120 "$SERVER_LOG" || true
      exit 1
    fi
    PORT=3002 npm run start >> "$SERVER_LOG" 2>&1 &
  else
    echo "Health check not ready; starting Next dev server..."
    npm run dev > "$SERVER_LOG" 2>&1 &
  fi
  NEXT_PID=$!

  READY=0
  for _ in $(seq 1 90); do
    HEALTH_HTTP=$(curl -s -o /tmp/a7-health.json -w "%{http_code}" "$BASE_URL/api/health" || true)
    if [[ "$HEALTH_HTTP" == "200" ]]; then
      READY=1
      break
    fi
    sleep 1
  done

  if [[ "$READY" != "1" ]]; then
    echo "❌ API did not become healthy within timeout" >&2
    tail -n 80 "$SERVER_LOG" || true
    exit 1
  fi
fi
echo "✅ HEALTH_HTTP=$HEALTH_HTTP"

echo ""
echo "2) Create job (Flow 1 path) so we have a real job_id"
# Reuse Flow1 endpoints exactly so this script is self-contained.
MID=$(node - <<'NODEEOF'
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const owner = process.env.FLOW1_OWNER_ID || '00000000-0000-0000-0000-000000000001';

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

(async () => {
  const payloads = [
    { title: 'A7 Evidence Seed Manuscript', created_by: owner, user_id: owner, word_count: 1000, work_type: 'novel' },
    { title: 'A7 Evidence Seed Manuscript', user_id: owner, word_count: 1000, work_type: 'novel' },
  ];

  let data = null;
  let lastError = null;

  for (const payload of payloads) {
    const result = await client.from('manuscripts').insert(payload).select('id,user_id').single();
    if (!result.error && result.data?.id) { data = result.data; break; }
    lastError = result.error;
  }

  if (!data) {
    console.error('INSERT_ERROR ' + (lastError?.message || 'unknown error'));
    process.exit(1);
  }

  process.stdout.write(String(data.id));
})();
NODEEOF
)
echo "✅ manuscript_id=$MID owner=$OWNER_ID"

CREATE_HTTP=$(curl -s -o /tmp/a7-create.json -w "%{http_code}" \
  -H "content-type: application/json" \
  -H "x-user-id: $OWNER_ID" \
  -X POST "$BASE_URL/api/jobs" \
  -d "{\"manuscript_id\":$MID,\"job_type\":\"evaluate_quick\"}" || true)

echo "CREATE_HTTP=$CREATE_HTTP"
cat /tmp/a7-create.json

JOB_ID=$(python3 - <<'PY'
import json, sys
with open('/tmp/a7-create.json','r',encoding='utf-8') as f:
    body=json.load(f)
if body.get('ok') is not True:
    print('❌ CREATE missing ok=true'); sys.exit(1)
job_id = body.get('job_id')
if not isinstance(job_id,str) or not job_id.strip():
    print('❌ CREATE missing job_id'); sys.exit(1)
print(job_id)
PY
)
if [[ "$CREATE_HTTP" != "201" ]]; then
  echo "❌ Expected CREATE_HTTP=201" >&2
  exit 1
fi
echo "✅ JOB_ID=$JOB_ID"

echo ""
echo "3) Create share as owner (x-user-id auth)"
SHARE_CREATE_HTTP=$(curl -s -o /tmp/a7-share-create.json -w "%{http_code}" \
  -H "content-type: application/json" \
  -H "x-user-id: $OWNER_ID" \
  -X POST "$BASE_URL/api/report-shares" \
  -d "{\"jobId\":\"$JOB_ID\",\"expiresInHours\":1}" || true)

echo "SHARE_CREATE_HTTP=$SHARE_CREATE_HTTP"
cat /tmp/a7-share-create.json

python3 - <<'PY'
import json, sys
with open('/tmp/a7-share-create.json','r',encoding='utf-8') as f:
    body=json.load(f)
sid = body.get('shareId')
url = body.get('shareUrl')
if not isinstance(sid,str) or not sid.strip():
    print('❌ missing shareId'); sys.exit(1)
if not isinstance(url,str) or '/share/' not in url:
    print('❌ missing shareUrl'); sys.exit(1)
print('✅ share create payload validated')
PY

if [[ "$SHARE_CREATE_HTTP" != "200" ]]; then
  echo "❌ Expected SHARE_CREATE_HTTP=200" >&2
  exit 1
fi

SHARE_ID=$(python3 - <<'PY'
import json
with open('/tmp/a7-share-create.json','r',encoding='utf-8') as f:
    body=json.load(f)
print(body['shareId'])
PY
)

SHARE_URL=$(python3 - <<'PY'
import json
with open('/tmp/a7-share-create.json','r',encoding='utf-8') as f:
    body=json.load(f)
print(body['shareUrl'])
PY
)

echo "✅ SHARE_ID=$SHARE_ID"
echo "✅ SHARE_URL=$SHARE_URL"

echo ""
echo "4) Non-owner cannot create share (strict 404/no leak)"
SHARE_OTHER_HTTP=$(curl -s -o /tmp/a7-share-other.json -w "%{http_code}" \
  -H "content-type: application/json" \
  -H "x-user-id: $OTHER_ID" \
  -X POST "$BASE_URL/api/report-shares" \
  -d "{\"jobId\":\"$JOB_ID\",\"expiresInHours\":1}" || true)

echo "SHARE_OTHER_HTTP=$SHARE_OTHER_HTTP"
cat /tmp/a7-share-other.json

if [[ "$SHARE_OTHER_HTTP" != "404" ]]; then
  echo "❌ Expected SHARE_OTHER_HTTP=404" >&2
  exit 1
fi
echo "✅ Non-owner create blocked (404)"

echo ""
echo "5) View share as anon (must not require auth)"
SHARE_VIEW_HTTP=$(curl -s -L -o /tmp/a7-share.html -w "%{http_code}" \
  "$SHARE_URL" || true)

echo "SHARE_VIEW_HTTP=$SHARE_VIEW_HTTP"
if [[ "$SHARE_VIEW_HTTP" != "200" ]]; then
  echo "❌ Expected SHARE_VIEW_HTTP=200" >&2
  tail -n 80 /tmp/a7-share.html || true
  exit 1
fi

# Required markers (A7 proves A6 credibility can be shown safely)
grep -q "Evaluation Report" /tmp/a7-share.html || { echo "❌ missing Evaluation Report" >&2; exit 1; }
grep -q "Score Explanation" /tmp/a7-share.html || { echo "❌ missing Score Explanation" >&2; exit 1; }
grep -q "Confidence" /tmp/a7-share.html || { echo "❌ missing Confidence" >&2; exit 1; }
grep -q "Provenance" /tmp/a7-share.html || { echo "❌ missing Provenance" >&2; exit 1; }

echo "✅ Share page rendered with credibility markers"

echo ""
echo "6) Revoke share as owner"
SHARE_REVOKE_HTTP=$(curl -s -o /tmp/a7-share-revoke.json -w "%{http_code}" \
  -H "x-user-id: $OWNER_ID" \
  -X POST "$BASE_URL/api/report-shares/$SHARE_ID/revoke" || true)

echo "SHARE_REVOKE_HTTP=$SHARE_REVOKE_HTTP"
cat /tmp/a7-share-revoke.json

if [[ "$SHARE_REVOKE_HTTP" != "200" ]]; then
  echo "❌ Expected SHARE_REVOKE_HTTP=200" >&2
  exit 1
fi
python3 - <<'PY'
import json, sys
with open('/tmp/a7-share-revoke.json','r',encoding='utf-8') as f:
    body=json.load(f)
if body.get('ok') is not True:
    print('❌ revoke ok != true'); sys.exit(1)
print('✅ revoke payload validated')
PY

echo ""
echo "7) View revoked share must fail-closed (404)"
REVOKED_HTTP=$(curl -s -o /tmp/a7-revoked.html -w "%{http_code}" "$SHARE_URL" || true)
echo "REVOKED_HTTP=$REVOKED_HTTP"

if [[ "$REVOKED_HTTP" != "404" ]]; then
  echo "❌ Expected REVOKED_HTTP=404" >&2
  tail -n 40 /tmp/a7-revoked.html || true
  exit 1
fi
echo "✅ revoked share is fail-closed 404"

echo ""
echo "8) Invalid token must fail-closed (404)"
INVALID_HTTP=$(curl -s -o /tmp/a7-invalid.html -w "%{http_code}" \
  "$BASE_URL/share/this_is_not_a_real_token" || true)

echo "INVALID_HTTP=$INVALID_HTTP"
if [[ "$INVALID_HTTP" != "404" ]]; then
  echo "❌ Expected INVALID_HTTP=404" >&2
  tail -n 40 /tmp/a7-invalid.html || true
  exit 1
fi
echo "✅ invalid token is fail-closed 404"

echo ""
echo "========================================="
echo "✅ GATE A7 EVIDENCE: PASS"
echo "========================================="
echo "HEALTH_HTTP=$HEALTH_HTTP"
echo "CREATE_HTTP=$CREATE_HTTP"
echo "SHARE_CREATE_HTTP=$SHARE_CREATE_HTTP"
echo "SHARE_OTHER_HTTP=$SHARE_OTHER_HTTP"
echo "SHARE_VIEW_HTTP=$SHARE_VIEW_HTTP"
echo "SHARE_REVOKE_HTTP=$SHARE_REVOKE_HTTP"
echo "REVOKED_HTTP=$REVOKED_HTTP"
echo "INVALID_HTTP=$INVALID_HTTP"
echo "JOB_ID=$JOB_ID"
echo "SHARE_ID=$SHARE_ID"
echo "Ended: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "Evidence archived: $LOG"
