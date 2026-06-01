#!/usr/bin/env bash
set -euo pipefail

# Resumable CI continuation loop for PR branches.
# - Polls PR checks
# - Optionally skips the first failing check (for parallel human handling)
# - Runs targeted local validation for known failure classes
# - Re-runs failed GitHub Actions runs
# - Persists checkpoint state so it can be restarted safely

STATE_DIR=".copilot-state"
STATE_FILE="${STATE_DIR}/continue-ci-state.json"
LOG_FILE="${STATE_DIR}/continue-ci.log"

INTERVAL_SECS="${CONTINUE_CI_INTERVAL_SECS:-45}"
MAX_ITERATIONS="${CONTINUE_CI_MAX_ITERATIONS:-0}" # 0 = unlimited
SKIP_FIRST_FAILURE="${CONTINUE_CI_SKIP_FIRST_FAILURE:-1}"
PR_NUMBER="${1:-}"

mkdir -p "${STATE_DIR}"

timestamp() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

log() {
  local msg="[$(timestamp)] $*"
  echo "${msg}" | tee -a "${LOG_FILE}"
}

require_cmd() {
  local cmd="$1"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "Missing required command: ${cmd}" >&2
    exit 2
  fi
}

require_cmd gh
require_cmd jq

if [[ -z "${PR_NUMBER}" ]]; then
  PR_NUMBER="$(gh pr view --json number -q .number)"
fi

if [[ -z "${PR_NUMBER}" ]]; then
  echo "Unable to resolve PR number. Pass it as: scripts/copilot-continue-ci.sh <pr-number>" >&2
  exit 2
fi

OWNER="$(gh repo view --json owner -q .owner.login)"
REPO="$(gh repo view --json name -q .name)"

log "Starting CI continuation loop for ${OWNER}/${REPO} PR #${PR_NUMBER}"
log "Checkpoint file: ${STATE_FILE}"

iteration=0

while true; do
  iteration=$((iteration + 1))

  sha="$(gh pr view "${PR_NUMBER}" --json headRefOid -q .headRefOid)"
  checks_json="$(gh pr checks "${PR_NUMBER}" --json name,state,link)"

  echo "${checks_json}" > "${STATE_DIR}/checks.latest.json"

  failed_json="$(echo "${checks_json}" | jq '[.[] | select(.state == "FAILURE" or .state == "ERROR")]')"
  failed_count="$(echo "${failed_json}" | jq 'length')"

  jq -n \
    --arg now "$(timestamp)" \
    --arg owner "${OWNER}" \
    --arg repo "${REPO}" \
    --arg pr "${PR_NUMBER}" \
    --arg sha "${sha}" \
    --argjson iteration "${iteration}" \
    --argjson failed_count "${failed_count}" \
    --argjson checks "${checks_json}" \
    '{
      updated_at: $now,
      owner: $owner,
      repo: $repo,
      pr_number: ($pr | tonumber),
      head_sha: $sha,
      iteration: $iteration,
      failed_count: $failed_count,
      checks: $checks
    }' > "${STATE_FILE}"

  if [[ "${failed_count}" == "0" ]]; then
    log "All checks are green for head ${sha}. Exiting continuation loop."
    exit 0
  fi

  log "Iteration ${iteration}: found ${failed_count} failing checks for ${sha}."

  selected_failed="${failed_json}"
  if [[ "${SKIP_FIRST_FAILURE}" == "1" ]]; then
    selected_failed="$(echo "${failed_json}" | jq 'if length > 0 then .[1:] else . end')"
    skipped_name="$(echo "${failed_json}" | jq -r 'if length > 0 then .[0].name else "" end')"
    if [[ -n "${skipped_name}" ]]; then
      log "Skipping first failing check this cycle (delegated elsewhere): ${skipped_name}"
    fi
  fi

  selected_count="$(echo "${selected_failed}" | jq 'length')"
  if [[ "${selected_count}" == "0" ]]; then
    log "No remaining failing checks after skip policy. Waiting for next cycle."
  else
    # Targeted local validation for known classes.
    if echo "${selected_failed}" | jq -e '.[] | select(.name == "CI")' >/dev/null; then
      log "Running targeted local validation for CI failures..."
      if npx jest __tests__/lib/evaluation/processor.chunk-routing.test.ts --runInBand; then
        log "Targeted validation passed."
      else
        log "Targeted validation failed; leaving logs in terminal for investigation."
      fi
    fi

    # Re-run failed workflow runs for selected checks.
    run_ids="$(echo "${selected_failed}" | jq -r '.[] | .link // "" | (try capture("actions/runs/(?<run>[0-9]+)").run catch empty)' | sort -u)"
    if [[ -n "${run_ids}" ]]; then
      while IFS= read -r run_id; do
        [[ -z "${run_id}" ]] && continue
        log "Re-running failed jobs for workflow run ${run_id}"
        gh run rerun "${run_id}" --failed || log "Warning: rerun failed for run ${run_id}"
      done <<< "${run_ids}"
    else
      log "No actionable Actions run IDs found in selected failures."
    fi
  fi

  if [[ "${MAX_ITERATIONS}" != "0" && "${iteration}" -ge "${MAX_ITERATIONS}" ]]; then
    log "Reached MAX_ITERATIONS=${MAX_ITERATIONS}. Exiting continuation loop."
    exit 1
  fi

  log "Sleeping ${INTERVAL_SECS}s before next cycle..."
  sleep "${INTERVAL_SECS}"
done
