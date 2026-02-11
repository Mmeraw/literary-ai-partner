#!/usr/bin/env bash
# Flow 1 Proof: End-to-end evaluation job test
# Tests: job creation → worker execution → result retrieval
# Canon-compliant: uses status='complete' (JOB_CONTRACT_v1)

set -euo pipefail

BASE="${BASE:-http://127.0.0.1:3002}"
USER_ID="11111111-1111-1111-1111-111111111111"

HEALTH_JSON="/tmp/flow1_health.json"
JOB_JSON_FILE="/tmp/flow1_job.json"
WORKER_JSON="/tmp/flow1_worker.json"
RESULT_JSON="/tmp/flow1_result.json"

cleanup() {
  rm -f "$HEALTH_JSON" "$JOB_JSON_FILE" "$WORKER_JSON" "$RESULT_JSON" >/dev/null 2>&1 || true
}
trap cleanup EXIT

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || {
    echo "❌ Missing required command: $cmd"
    exit 1
  }
}

require_cmd curl
require_cmd node
require_cmd rg
require_cmd tr
require_cmd sed
require_cmd cut
require_cmd head

# Read CRON_SECRET from .env.local (CANON name)
# MISTAKE-PROOFING:
# - rg -N (NO line numbers) prevents "28:CRON_SECRET=..." contamination
# - cut after '=' ensures we only capture the value
# - strip CRLF + optional wrapping quotes
CRON_SECRET_VALUE="$(
  rg -N '^CRON_SECRET=' .env.local \
    | head -n 1 \
    | cut -d= -f2- \
    | tr -d '\r' \
    | sed 's/^"//; s/"$//'
)"

if [[ -z "${CRON_SECRET_VALUE}" ]]; then
  echo "❌ CRON_SECRET not found (or empty) in .env.local"
  echo "   Expected a line like: CRON_SECRET=your-secret"
  exit 1
fi

# Extra guard: detect common failure modes explicitly.
# If someone reintroduces rg -n, you might get "28:CRON_SECRET=...".
# If someone botches parsing, you might include "CRON_SECRET=".
if [[ "${CRON_SECRET_VALUE}" == *"CRON_SECRET="* ]] || [[ "${CRON_SECRET_VALUE}" =~ ^[0-9]+:CRON_SECRET= ]]; then
  echo "❌ CRON_SECRET extraction is contaminated (it contains 'CRON_SECRET=' or a line-number prefix)."
  echo "   Fix: ensure you use 'rg -N' (NOT '-n') and cut after '='."
  echo "   Extracted value: ${CRON_SECRET_VALUE}"
  exit 1
fi

echo "== Health Check =="
echo "Testing connection to ${BASE}/api/health"

# MISTAKE-PROOFING:
# - Retry to survive cold-start compile / slow first response
ok="false"
for attempt in 1 2 3 4 5; do
  if curl -fsS --max-time 20 "${BASE}/api/health" -o "$HEALTH_JSON" >/dev/null 2>&1; then
    ok="true"
    break
  fi
  echo "Health attempt ${attempt} failed; retrying..."
  sleep 1
done

if [[ "$ok" != "true" ]]; then
  echo "❌ Health check failed"
  echo "   Confirm dev server is running: PORT=3002 npm run dev"
  echo "   Confirm reachable: curl -i ${BASE}/api/health"
  exit 1
fi

echo "✓ Server is healthy"
node -e "const s=require('fs').readFileSync('${HEALTH_JSON}','utf8'); console.log(s)"
echo

echo "== Create Evaluation Job =="

# Capture body to file (avoids pipe issues). Use curl exit code to fail fast.
if ! curl -fsS --max-time 25 -X POST "${BASE}/api/jobs" \
  -H "content-type: application/json" \
  -H "x-user-id: ${USER_ID}" \
  -d '{"job_type":"evaluate_full","manuscript_text":"Flow 1 proof sample manuscript content for testing end-to-end evaluation pipeline."}' \
  -o "$JOB_JSON_FILE" >/dev/null 2>&1; then
  echo "❌ Failed to create job"
  echo "Response:"
  [[ -f "$JOB_JSON_FILE" ]] && cat "$JOB_JSON_FILE" || echo "(no body captured)"
  exit 1
fi

cat "$JOB_JSON_FILE"

JOB_ID="$(
  node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('${JOB_JSON_FILE}','utf8')); process.stdout.write(String(j.job_id||''));"
)"

if [[ -z "${JOB_ID}" ]]; then
  echo "❌ No job_id returned"
  exit 1
fi
echo "✓ JOB_ID=${JOB_ID}"
echo

echo "== Trigger Worker (auth via ?secret=) =="

# MISTAKE-PROOFING:
# - Use -G + --data-urlencode so secrets with special chars never break auth
WORKER_HTTP="$(
  curl -sS --max-time 30 -o "$WORKER_JSON" -w '%{http_code}' \
    -G "${BASE}/api/workers/process-evaluations" \
    --data-urlencode "secret=${CRON_SECRET_VALUE}" \
  || echo "000"
)"

echo "Response: HTTP ${WORKER_HTTP}"
if [[ -f "$WORKER_JSON" ]]; then
  cat "$WORKER_JSON" || true
  echo
fi

if [[ "${WORKER_HTTP}" != "200" ]]; then
  echo "❌ Worker returned HTTP ${WORKER_HTTP} (expected 200)"
  echo "Debug:"
  echo "  - If you see 401, your secret is wrong OR extraction was contaminated."
  echo "  - This script uses rg -N + --data-urlencode to avoid the known failure modes."
  exit 1
fi
echo "✓ Worker executed successfully"
echo

echo "== Poll for Evaluation Result =="

for i in $(seq 1 30); do
  HTTP="$(
    curl -sS --max-time 15 -o "$RESULT_JSON" -w '%{http_code}' \
      -H "x-user-id: ${USER_ID}" \
      "${BASE}/api/jobs/${JOB_ID}/evaluation-result" \
    || echo "000"
  )"

  if [[ "${HTTP}" == "200" ]]; then
    echo "Attempt ${i} => HTTP ${HTTP} ✓"
    echo
    echo "✅ SUCCESS: Evaluation result retrieved"
    node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('${RESULT_JSON}','utf8')); console.log(JSON.stringify(j,null,2));" 2>/dev/null || cat "$RESULT_JSON"
    echo
    exit 0
  elif [[ "${HTTP}" == "404" ]]; then
    echo "Attempt ${i} => HTTP ${HTTP} (result not ready yet)"
  else
    echo "Attempt ${i} => HTTP ${HTTP}"
    if [[ -f "$RESULT_JSON" ]]; then
      cat "$RESULT_JSON" || true
      echo
    fi
  fi

  sleep 1
done

echo
echo "❌ RESULT NOT FOUND after 30 seconds of polling"
echo "Job may still be processing or failed."
echo
echo "Debug: Check job status directly:"
echo "curl -H 'x-user-id: ${USER_ID}' ${BASE}/api/jobs/${JOB_ID}"
exit 2
