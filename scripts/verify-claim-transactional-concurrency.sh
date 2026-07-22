#!/usr/bin/env bash
set -euo pipefail

PG_URL="${PG_URL:-postgres://postgres:postgres@localhost:5432/testdb}"
PROOF_DIR="$(mktemp -d)"
trap 'rm -rf "$PROOF_DIR"' EXIT

run_race() {
  local rpc_name="$1"
  local job_id="$2"
  local worker_a="production:127.0.0.1:${rpc_name}-a"
  local worker_b="production:127.0.0.1:${rpc_name}-b"
  local token_a="00000000-0000-4000-8000-00000000000a"
  local token_b="00000000-0000-4000-8000-00000000000b"

  if [[ "$rpc_name" == "by-id" ]]; then
    psql "$PG_URL" -v ON_ERROR_STOP=1 -Atq -c \
      "SELECT id FROM public.claim_evaluation_job_by_id('$job_id', '$worker_a', '$token_a', now() + interval '5 minutes');" \
      >"$PROOF_DIR/a.out" &
    local pid_a=$!
    psql "$PG_URL" -v ON_ERROR_STOP=1 -Atq -c \
      "SELECT id FROM public.claim_evaluation_job_by_id('$job_id', '$worker_b', '$token_b', now() + interval '5 minutes');" \
      >"$PROOF_DIR/b.out" &
    local pid_b=$!
  else
    psql "$PG_URL" -v ON_ERROR_STOP=1 -Atq -c \
      "SELECT id FROM public.claim_evaluation_jobs(1, '$worker_a', '$token_a', now() + interval '5 minutes');" \
      >"$PROOF_DIR/a.out" &
    local pid_a=$!
    psql "$PG_URL" -v ON_ERROR_STOP=1 -Atq -c \
      "SELECT id FROM public.claim_evaluation_jobs(1, '$worker_b', '$token_b', now() + interval '5 minutes');" \
      >"$PROOF_DIR/b.out" &
    local pid_b=$!
  fi

  wait "$pid_a"
  wait "$pid_b"

  local winner_count
  winner_count="$(awk 'NF { count++ } END { print count+0 }' "$PROOF_DIR/a.out" "$PROOF_DIR/b.out")"
  if [[ "$winner_count" != "1" ]]; then
    echo "Expected exactly one $rpc_name claim winner; observed $winner_count" >&2
    echo "worker-a=$(tr '\n' ' ' <"$PROOF_DIR/a.out")" >&2
    echo "worker-b=$(tr '\n' ' ' <"$PROOF_DIR/b.out")" >&2
    exit 1
  fi

  psql "$PG_URL" -v ON_ERROR_STOP=1 -Atq <<SQL
DO \$\$
DECLARE
  claimed public.evaluation_jobs%ROWTYPE;
BEGIN
  SELECT * INTO claimed FROM public.evaluation_jobs WHERE id = '$job_id';
  IF claimed.status <> 'running' OR claimed.phase_status <> 'running' THEN
    RAISE EXCEPTION '$rpc_name race did not atomically transition the row to running';
  END IF;
  IF claimed.claimed_by NOT IN ('$worker_a', '$worker_b') THEN
    RAISE EXCEPTION '$rpc_name race persisted an unknown claimant: %', claimed.claimed_by;
  END IF;
  IF claimed.lease_token IS NULL OR claimed.lease_until IS NULL THEN
    RAISE EXCEPTION '$rpc_name race omitted lease ownership';
  END IF;
  IF jsonb_array_length(COALESCE(claimed.progress->'claim_events', '[]'::jsonb)) <> 1 THEN
    RAISE EXCEPTION '$rpc_name race persisted more or fewer than one claim event';
  END IF;
END
\$\$;
SQL
}

psql "$PG_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
TRUNCATE public.evaluation_jobs;
INSERT INTO public.evaluation_jobs (id, status, phase_status, phase, created_at, retry_count, progress)
VALUES ('10000000-0000-4000-8000-000000000001', 'queued', 'queued', 'phase_2', now(), 0, '{}'::jsonb);
SQL
run_race "by-id" "10000000-0000-4000-8000-000000000001"

psql "$PG_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
TRUNCATE public.evaluation_jobs;
INSERT INTO public.evaluation_jobs (id, status, phase_status, phase, created_at, retry_count, progress)
VALUES ('20000000-0000-4000-8000-000000000002', 'queued', 'queued', 'phase_2', now(), 0, '{}'::jsonb);
SQL
run_race "batch" "20000000-0000-4000-8000-000000000002"

echo "Transactional claim concurrency proof passed: both production RPCs produced exactly one winner."
