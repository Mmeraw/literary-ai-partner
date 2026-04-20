#!/usr/bin/env bash
set -euo pipefail

# Canonical post-deploy proof loop for claim eligibility
#
# Required:
#   JOB_ID=<fresh-post-deploy-job-id>
#
# Optional:
#   BASE_URL=https://literary-ai-partner.vercel.app
#   CRON_SECRET=<cron-secret>              # preferred manual auth path
#   EXPECT_GIT_SHA=<deployed git sha>      # fail if prod not on expected commit
#
# Usage:
#   JOB_ID=<uuid> ./scripts/incident-claim-proof-fresh.sh
#   JOB_ID=<uuid> CRON_SECRET=... EXPECT_GIT_SHA=<sha> ./scripts/incident-claim-proof-fresh.sh

BASE_URL="${BASE_URL:-https://literary-ai-partner.vercel.app}"
JOB_ID="${JOB_ID:-}"
CRON_SECRET="${CRON_SECRET:-}"
EXPECT_GIT_SHA="${EXPECT_GIT_SHA:-}"
NOW_EPOCH="$(date +%s)"

if [[ -z "$JOB_ID" ]]; then
  echo "ERROR: JOB_ID is required and must be a FRESH post-deploy job." >&2
  exit 2
fi

fetch_json() {
  local url="$1"
  local attempts="${2:-4}"
  local sleep_s="${3:-2}"
  local i body http_code tmp

  tmp="$(mktemp)"
  for ((i=1; i<=attempts; i++)); do
    http_code="$(
      curl -sS \
        -o "$tmp" \
        -w "%{http_code}" \
        "$url" || true
    )"
    body="$(cat "$tmp" 2>/dev/null || true)"

    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]] && [[ -n "$body" ]]; then
      if python -c 'import json,sys; json.loads(sys.stdin.read())' <<< "$body" >/dev/null 2>&1; then
        printf '%s' "$body"
        rm -f "$tmp"
        return 0
      fi
    fi

    if [[ "$i" -lt "$attempts" ]]; then
      sleep "$sleep_s"
    fi
  done

  echo "ERROR: failed to fetch valid JSON from $url after $attempts attempt(s)" >&2
  rm -f "$tmp"
  return 1
}

echo "== fresh incident claim proof =="
echo "base_url=$BASE_URL"
echo "job_id=$JOB_ID"
if [[ -n "$CRON_SECRET" ]]; then
  echo "auth_mode=bearer-cron-secret"
else
  echo "auth_mode=synthetic-vercel-cron-headers"
fi
echo

echo "[1/7] Health check"
HEALTH_JSON="$(fetch_json "$BASE_URL/api/health")"
echo "$HEALTH_JSON" | python -m json.tool | sed -n '1,80p'

DEPLOYED_SHA="$(python -c 'import json,sys; o=json.load(sys.stdin); print(o.get("git_sha",""))' <<< "$HEALTH_JSON")"
if [[ -n "$EXPECT_GIT_SHA" && "$DEPLOYED_SHA" != "$EXPECT_GIT_SHA" ]]; then
  echo "ERROR: prod git_sha ($DEPLOYED_SHA) does not match EXPECT_GIT_SHA ($EXPECT_GIT_SHA)" >&2
  exit 3
fi

echo
echo "[2/7] Pre-state snapshot"
PRE_JSON="$(fetch_json "$BASE_URL/api/jobs")"
PRE_JOB="$(
  python - "$JOB_ID" <<'PY' <<< "$PRE_JSON"
import json, sys
job_id = sys.argv[1]
o = json.loads(sys.stdin.read())
matches = [j for j in o.get("jobs", []) if j.get("id") == job_id]
print(json.dumps(matches[0] if matches else {"missing": job_id}))
PY
)"
echo "$PRE_JOB" | python -m json.tool

PRE_STATUS="$(python -c 'import json,sys; j=json.load(sys.stdin); print(j.get("status","missing"))' <<< "$PRE_JOB")"
PRE_UPDATED_AT="$(python -c 'import json,sys; j=json.load(sys.stdin); print(j.get("updated_at",""))' <<< "$PRE_JOB")"

if [[ "$PRE_STATUS" == "missing" ]]; then
  echo "ERROR: job not found in /api/jobs: $JOB_ID" >&2
  exit 4
fi

echo
echo "[3/7] Fresh-row contract check"
python - <<'PY' <<< "$PRE_JOB"
import json, sys
j = json.load(sys.stdin)
has_top_phase = "phase" in j and j.get("phase") is not None
has_top_phase_status = "phase_status" in j and j.get("phase_status") is not None
print(f"top_level_phase_present={str(has_top_phase).lower()}")
print(f"top_level_phase_status_present={str(has_top_phase_status).lower()}")
if not has_top_phase or not has_top_phase_status:
    print("WARNING: this row still looks pre-patch or non-canonical for claim eligibility.")
PY

echo
echo "[4/7] Trigger one worker run"
if [[ -n "$CRON_SECRET" ]]; then
  RUN_JSON="$(
    curl -sS "$BASE_URL/api/workers/process-evaluations" \
      -H "Authorization: Bearer $CRON_SECRET"
  )"
else
  RUN_JSON="$(
    curl -sS "$BASE_URL/api/workers/process-evaluations" \
      -H "x-vercel-cron: 1" \
      -H "x-vercel-id: incident-proof-$NOW_EPOCH" \
      -H "user-agent: incident-proof"
  )"
fi

echo "$RUN_JSON" | python -m json.tool | sed -n '1,220p'

CLAIMED="$(python -c 'import json,sys; o=json.load(sys.stdin); print(int(o.get("claimed",0)))' <<< "$RUN_JSON" 2>/dev/null || echo 0)"
TRACE_ID="$(python -c 'import json,sys; o=json.load(sys.stdin); print(o.get("traceId",""))' <<< "$RUN_JSON" 2>/dev/null || echo "")"

echo
echo "[5/7] Post-state snapshot"
POST_JSON="$(fetch_json "$BASE_URL/api/jobs")"
POST_JOB="$(
  python - "$JOB_ID" <<'PY' <<< "$POST_JSON"
import json, sys
job_id = sys.argv[1]
o = json.loads(sys.stdin.read())
matches = [j for j in o.get("jobs", []) if j.get("id") == job_id]
print(json.dumps(matches[0] if matches else {"missing": job_id}))
PY
)"
echo "$POST_JOB" | python -m json.tool

POST_STATUS="$(python -c 'import json,sys; j=json.load(sys.stdin); print(j.get("status","missing"))' <<< "$POST_JOB")"
POST_UPDATED_AT="$(python -c 'import json,sys; j=json.load(sys.stdin); print(j.get("updated_at",""))' <<< "$POST_JOB")"

UPDATED_CHANGED="false"
if [[ -n "$PRE_UPDATED_AT" && -n "$POST_UPDATED_AT" && "$PRE_UPDATED_AT" != "$POST_UPDATED_AT" ]]; then
  UPDATED_CHANGED="true"
fi

echo
echo "[6/7] Decision summary"
echo "deployed_git_sha=$DEPLOYED_SHA"
echo "claimed=$CLAIMED"
echo "pre_status=$PRE_STATUS"
echo "post_status=$POST_STATUS"
echo "updated_at_changed=$UPDATED_CHANGED"
echo "trace_id=$TRACE_ID"

DECISION=""
if [[ "$CLAIMED" -gt 0 ]] && [[ "$POST_STATUS" == "running" || "$POST_STATUS" == "complete" || "$POST_STATUS" == "failed" ]]; then
  DECISION="CASE_A_PRIMARY_FIX_CONFIRMED"
elif [[ "$CLAIMED" -eq 0 ]]; then
  DECISION="CASE_B_ZERO_CLAIMS"
else
  DECISION="CASE_C_CLAIMED_BUT_UNEXPECTED_STATE"
fi
echo "decision=$DECISION"

echo
echo "[7/7] Next action hints"
if [[ "$DECISION" == "CASE_A_PRIMARY_FIX_CONFIRMED" ]]; then
  cat <<'TXT'
- Fresh post-deploy row is claimable.
- Creator/claim seam is fixed.
- If older queued rows remain stuck, treat them as historical remediation (normalize, requeue, or fail+resubmit).
TXT
elif [[ "$DECISION" == "CASE_B_ZERO_CLAIMS" ]]; then
  cat <<'TXT'
- If this was truly a fresh post-deploy job, predicate mismatch may still exist OR claim RPC write path is failing.
- Check function logs for SQLSTATE 42804, lease_token, lease_expires_at, claim_evaluation_jobs.
- If those reappear, you are in "Case B-prime": predicate fixed, claim write still broken.
TXT
else
  cat <<'TXT'
- Claim happened, but job did not settle into expected visible state.
- Next layer is processor/runtime failure or claim-write/lease behavior.
TXT
fi

echo
echo "Log search suggestion:"
echo "  trace_id=$TRACE_ID"
echo "  search terms: 42804 OR lease_token OR lease_expires_at OR claim_evaluation_jobs"
