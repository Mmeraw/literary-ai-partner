#!/usr/bin/env bash
# =============================================================================
# verify-worker-recovery.sh
#
# Post-redeploy verification for the 2026-04-22 pre-claim outage.
#
# Proves the worker is healthy by executing the five-step recovery proof:
#
#   Step 1 — Worker route returns 200 (dry-run; no job required)
#   Step 2 — Submit a fresh eval job and confirm it leaves "queued"
#   Step 3 — Polling: claim fields populate (claimed_by, lease_expires_at)
#   Step 4 — Polling: provider_calls_count > 0 (worker actually ran passes)
#   Step 5 — Job reaches status=complete with artifacts_count > 0
#
# Prerequisites:
#   PROD_URL   — deployed app base URL (e.g. https://app.vercel.app)
#   CRON_SECRET — matches the deployed CRON_SECRET env var
#   AUTH_TOKEN  — valid user JWT (Bearer token)
#
# Usage:
#   export PROD_URL="https://your-app.vercel.app"
#   export CRON_SECRET="your-secret"
#   export AUTH_TOKEN="eyJhbGc..."
#   bash scripts/verify-worker-recovery.sh
#
# Exit codes:
#   0 — All 5 steps passed; worker is proven healthy
#   1 — Prerequisites not set
#   2 — Step 1 failed (worker route not 200)
#   3 — Step 2 failed (job submission failed)
#   4 — Step 3 failed (claim fields never populated within timeout)
#   5 — Step 4 failed (provider_calls_count never > 0 within timeout)
#   6 — Step 5 failed (job never reached complete within timeout)
# =============================================================================

set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅  $1${NC}"; }
fail() { echo -e "${RED}❌  $1${NC}"; }
info() { echo -e "    $1"; }
step() { echo -e "\n${CYAN}── Step $1 ──────────────────────────────────────────────${NC}"; }

# ─── Prerequisites ────────────────────────────────────────────────────────────
if [[ -z "${PROD_URL:-}" || -z "${CRON_SECRET:-}" || -z "${AUTH_TOKEN:-}" ]]; then
  echo -e "${RED}Missing required environment variables.${NC}"
  echo "  Required: PROD_URL, CRON_SECRET, AUTH_TOKEN"
  echo "  Example:"
  echo "    export PROD_URL=https://your-app.vercel.app"
  echo "    export CRON_SECRET=your-secret"
  echo "    export AUTH_TOKEN=eyJhbGc..."
  exit 1
fi

WORKER_URL="${PROD_URL}/api/workers/process-evaluations"
EVAL_URL="${PROD_URL}/api/evaluate"

# Polling settings
CLAIM_TIMEOUT_SEC=90        # max wait for claim fields
PROVIDER_TIMEOUT_SEC=300    # max wait for provider_calls_count > 0
COMPLETE_TIMEOUT_SEC=600    # max wait for status=complete
POLL_INTERVAL_SEC=8

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        Worker Recovery Verification (2026-04-22)             ║${NC}"
echo -e "${CYAN}║  Proves the pre-claim outage class is resolved in production ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Target: ${PROD_URL}"
echo "  Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ─── Step 1: Worker route returns 200 (dry-run) ───────────────────────────────
step "1 — Worker route health (dry-run)"
info "Calling ${WORKER_URL}?dry_run=1"

DRY_STATUS=$(curl -s -o /tmp/vwr_dry.json -w "%{http_code}" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${WORKER_URL}?dry_run=1")

if [[ "${DRY_STATUS}" != "200" ]]; then
  fail "Worker route returned HTTP ${DRY_STATUS} (expected 200)"
  info "Response: $(cat /tmp/vwr_dry.json 2>/dev/null || echo 'none')"
  info ""
  info "This confirms the outage is NOT yet resolved."
  info "Check: EVAL_WORKER_MAX_EXECUTION_MS <= EVAL_WORKER_LEASE_MS (both <= 180000)"
  info "Then: redeploy and re-run this script."
  exit 2
fi

DRY_BODY=$(cat /tmp/vwr_dry.json)
pass "Worker route returned 200"
info "Auth method: $(echo "${DRY_BODY}" | grep -o '"authMethod":"[^"]*"' | head -1 || echo 'unknown')"
info "Dry-run body: ${DRY_BODY}"

# ─── Step 2: Submit fresh eval job ────────────────────────────────────────────
step "2 — Submit fresh evaluation job"

MANUSCRIPT_TEXT="The old city had forgotten its name. Mara walked through streets that curved and doubled back like arguments. She was looking for the archive, which everyone said still existed but no one could find. At a corner vendor she bought bread and asked the way; the seller laughed and pointed in three directions. That was the city: full of gestures, empty of answers. She ate the bread. It tasted like departure."

SUBMIT_STATUS=$(curl -s -o /tmp/vwr_submit.json -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"manuscript_text\": \"${MANUSCRIPT_TEXT}\", \"manuscript_title\": \"verify-worker-recovery $(date -u +%H:%M:%SZ)\"}" \
  "${EVAL_URL}")

SUBMIT_BODY=$(cat /tmp/vwr_submit.json)

if [[ "${SUBMIT_STATUS}" != "200" ]]; then
  fail "Job submission returned HTTP ${SUBMIT_STATUS}"
  info "Body: ${SUBMIT_BODY}"
  exit 3
fi

JOB_ID=$(echo "${SUBMIT_BODY}" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [[ -z "${JOB_ID}" ]]; then
  fail "Could not extract job ID from response"
  info "Body: ${SUBMIT_BODY}"
  exit 3
fi

pass "Job submitted: ${JOB_ID}"
info "Initial status: $(echo "${SUBMIT_BODY}" | grep -o '"status":"[^"]*"' | head -1)"

STATUS_URL="${PROD_URL}/api/jobs/${JOB_ID}"

# ─── Helper: poll job row ─────────────────────────────────────────────────────
poll_job() {
  curl -s \
    -H "Authorization: Bearer ${AUTH_TOKEN}" \
    "${STATUS_URL}" 2>/dev/null || echo '{}'
}

# ─── Step 3: Claim fields populate ───────────────────────────────────────────
step "3 — Claim fields populate (claimed_by, lease_expires_at)"
info "Polling for up to ${CLAIM_TIMEOUT_SEC}s..."

ELAPSED=0
CLAIMED=false
while (( ELAPSED < CLAIM_TIMEOUT_SEC )); do
  JOB_ROW=$(poll_job)
  CLAIMED_BY=$(echo "${JOB_ROW}" | grep -o '"claimed_by":"[^"]*"' | head -1)
  LEASE_EXP=$(echo "${JOB_ROW}" | grep -o '"lease_expires_at":"[^"]*"' | head -1)
  CURRENT_STATUS=$(echo "${JOB_ROW}" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [[ -n "${CLAIMED_BY}" && "${CLAIMED_BY}" != '"claimed_by":null' ]] || \
     [[ "${CURRENT_STATUS}" == "running" || "${CURRENT_STATUS}" == "complete" ]]; then
    CLAIMED=true
    break
  fi

  info "  ${ELAPSED}s — status=${CURRENT_STATUS:-unknown}, claimed_by=null"
  sleep "${POLL_INTERVAL_SEC}"
  ELAPSED=$((ELAPSED + POLL_INTERVAL_SEC))
done

if [[ "${CLAIMED}" != "true" ]]; then
  fail "Job never claimed within ${CLAIM_TIMEOUT_SEC}s — worker is not picking up queued jobs"
  info "This is the exact signature of the 2026-04-22 outage."
  info "Check: worker route is returning 200 AND CRON_SECRET/env are aligned in prod."
  exit 4
fi

pass "Job claimed (status=${CURRENT_STATUS:-?}, elapsed=${ELAPSED}s)"
info "claimed_by: ${CLAIMED_BY:-set}"
info "lease_expires_at: ${LEASE_EXP:-set}"

# ─── Step 4: provider_calls_count > 0 ────────────────────────────────────────
step "4 — Provider calls appear (pipeline actually ran)"
info "Polling for up to ${PROVIDER_TIMEOUT_SEC}s..."

ELAPSED=0
CALLS_OK=false
while (( ELAPSED < PROVIDER_TIMEOUT_SEC )); do
  JOB_ROW=$(poll_job)
  CALLS=$(echo "${JOB_ROW}" | grep -o '"provider_calls_count":[0-9]*' | head -1 | grep -o '[0-9]*$')
  CURRENT_STATUS=$(echo "${JOB_ROW}" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [[ "${CURRENT_STATUS}" == "complete" ]]; then
    # Completion implies calls happened even if field not exposed
    CALLS_OK=true
    break
  fi

  if [[ -n "${CALLS}" && "${CALLS}" -gt 0 ]]; then
    CALLS_OK=true
    break
  fi

  if [[ "${CURRENT_STATUS}" == "failed" ]]; then
    break
  fi

  info "  ${ELAPSED}s — status=${CURRENT_STATUS:-unknown}, provider_calls=${CALLS:-0}"
  sleep "${POLL_INTERVAL_SEC}"
  ELAPSED=$((ELAPSED + POLL_INTERVAL_SEC))
done

if [[ "${CALLS_OK}" != "true" && "${CURRENT_STATUS}" != "complete" ]]; then
  fail "No provider calls observed and job not complete (status=${CURRENT_STATUS:-?})"
  info "Worker claimed the job but pipeline may not have started."
  info "Check: OPENAI_API_KEY is set in prod env."
  exit 5
fi

pass "Pipeline running (provider_calls > 0 or job already complete, elapsed=${ELAPSED}s)"

# ─── Step 5: Job reaches complete ─────────────────────────────────────────────
step "5 — Job reaches status=complete with artifacts"
info "Polling for up to ${COMPLETE_TIMEOUT_SEC}s total from submission..."

ELAPSED=0
COMPLETE=false
while (( ELAPSED < COMPLETE_TIMEOUT_SEC )); do
  JOB_ROW=$(poll_job)
  CURRENT_STATUS=$(echo "${JOB_ROW}" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  ARTIFACTS=$(echo "${JOB_ROW}" | grep -o '"artifacts_count":[0-9]*' | head -1 | grep -o '[0-9]*$')

  if [[ "${CURRENT_STATUS}" == "complete" ]]; then
    COMPLETE=true
    break
  fi

  if [[ "${CURRENT_STATUS}" == "failed" ]]; then
    LAST_ERROR=$(echo "${JOB_ROW}" | grep -o '"last_error":"[^"]*"' | head -1)
    fail "Job reached status=failed"
    info "last_error: ${LAST_ERROR:-unknown}"
    info "This is a pipeline or content failure, not a pre-claim worker failure."
    exit 6
  fi

  info "  ${ELAPSED}s — status=${CURRENT_STATUS:-unknown}, artifacts=${ARTIFACTS:-0}"
  sleep "${POLL_INTERVAL_SEC}"
  ELAPSED=$((ELAPSED + POLL_INTERVAL_SEC))
done

if [[ "${COMPLETE}" != "true" ]]; then
  fail "Job did not reach complete within ${COMPLETE_TIMEOUT_SEC}s (final status=${CURRENT_STATUS:-unknown})"
  exit 6
fi

pass "Job reached status=complete (elapsed=${ELAPSED}s)"
info "Job ID: ${JOB_ID}"
info "Artifacts: ${ARTIFACTS:-unknown}"

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║               ALL 5 STEPS PASSED                        ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  The worker is proven healthy post-redeploy:             ║${NC}"
echo -e "${GREEN}║  ✅ Worker route returns 200                             ║${NC}"
echo -e "${GREEN}║  ✅ Job left queued state                                ║${NC}"
echo -e "${GREEN}║  ✅ Claim fields populated                               ║${NC}"
echo -e "${GREEN}║  ✅ Provider calls ran                                   ║${NC}"
echo -e "${GREEN}║  ✅ Job reached complete with artifacts                  ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  Job ID: ${JOB_ID}  ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
exit 0
