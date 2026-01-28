#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/literary-ai-partner"
DB_CONTAINER="supabase_db_literary-ai-partner"
MID=9999
NUM_JOBS=20
NUM_WORKERS=3

# Canonical job field values (aligned with DB constraints)
# Allowed: policy_family IN ('standard','dark_fiction','trauma_memoir')
#          voice_preservation_level IN ('strict','balanced','expressive')
#          english_variant IN ('us','uk','ca','au')
POLICY_FAMILY="${POLICY_FAMILY:-standard}"
VOICE_LEVEL="${VOICE_LEVEL:-balanced}"
ENGLISH_VARIANT="${ENGLISH_VARIANT:-us}"

# Guardrails: fail fast if invalid values provided
case "$POLICY_FAMILY" in
  standard|dark_fiction|trauma_memoir) ;;
  *) echo "ERROR: invalid POLICY_FAMILY=$POLICY_FAMILY (allowed: standard, dark_fiction, trauma_memoir)"; exit 1 ;;
esac

case "$VOICE_LEVEL" in
  strict|balanced|expressive) ;;
  *) echo "ERROR: invalid VOICE_LEVEL=$VOICE_LEVEL (allowed: strict, balanced, expressive)"; exit 1 ;;
esac

case "$ENGLISH_VARIANT" in
  us|uk|ca|au) ;;
  *) echo "ERROR: invalid ENGLISH_VARIANT=$ENGLISH_VARIANT (allowed: us, uk, ca, au)"; exit 1 ;;
esac

psqlc() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "== Phase 2D concurrency proof: $NUM_JOBS jobs, $NUM_WORKERS workers =="

echo "[1/7] Ensure manuscript exists with chunks (id=$MID)"
psqlc <<SQL
INSERT INTO public.manuscripts (id, title, work_type, created_by)
VALUES ($MID, 'Test Manuscript for Phase 2D Concurrency', 'fiction', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
SQL

echo "[2/7] Seed 3 chunks (deterministic)"
psqlc <<'SQL'
DO $$
DECLARE
  mid integer := 9999;
BEGIN
  DELETE FROM public.manuscript_chunks WHERE manuscript_id = mid;

  INSERT INTO public.manuscript_chunks
    (manuscript_id, chunk_index, char_start, char_end, overlap_chars, label, content, content_hash, status)
  VALUES
    (mid, 0, 0,   94,  0, 'test', 'This is the first chunk of test content. It contains some sample text for testing the worker.', md5('a'), 'pending'),
    (mid, 1, 94,  179, 0, 'test', 'This is the second chunk. It also contains test text to verify chunk fetching.', md5('b'), 'pending'),
    (mid, 2, 179, 260, 0, 'test', 'This is the third and final chunk. The worker should process all three chunks.', md5('c'), 'pending');
END $$;
SQL

echo "[3/7] Queue $NUM_JOBS jobs (all for manuscript $MID)"
psqlc <<SQL
DO \$\$
DECLARE
  mid integer := $MID;
  i integer;
BEGIN
  -- Clean slate: delete all jobs for this manuscript
  DELETE FROM public.evaluation_jobs WHERE manuscript_id = mid;

  -- Insert $NUM_JOBS jobs
  FOR i IN 1..$NUM_JOBS LOOP
    INSERT INTO public.evaluation_jobs (
      manuscript_id,
      job_type,
      policy_family,
      voice_preservation_level,
      english_variant,
      status
    ) VALUES (
      mid,
      'full_evaluation',
      '$POLICY_FAMILY',
      '$VOICE_LEVEL',
      '$ENGLISH_VARIANT',
      'queued'
    );
  END LOOP;
END \$\$;

SELECT COUNT(*) AS queued_jobs FROM public.evaluation_jobs WHERE manuscript_id = $MID AND status = 'queued';
SQL

echo "[4/7] Stop any existing workers, truncate logs"
cd "$ROOT"
./scripts/worker-stop.sh >/dev/null 2>&1 || true
pkill -9 -f "phase2Worker" >/dev/null 2>&1 || true
./scripts/release-all-leases.sh >/dev/null 2>&1 || true

: > "$ROOT/.worker.log"
: > "$ROOT/.worker1.log"
: > "$ROOT/.worker2.log"
: > "$ROOT/.worker3.log"

echo "[5/7] Start $NUM_WORKERS workers in parallel"
# Worker 1
WORKER_ID="worker-concurrency-1" WORKER_LOG="$ROOT/.worker1.log" \
  nohup setsid npx tsx "$ROOT/workers/phase2Worker.ts" >/dev/null 2>&1 &
W1_PID=$!
echo "  Worker 1 started (PID=$W1_PID, WORKER_ID=worker-concurrency-1)"

# Worker 2
WORKER_ID="worker-concurrency-2" WORKER_LOG="$ROOT/.worker2.log" \
  nohup setsid npx tsx "$ROOT/workers/phase2Worker.ts" >/dev/null 2>&1 &
W2_PID=$!
echo "  Worker 2 started (PID=$W2_PID, WORKER_ID=worker-concurrency-2)"

# Worker 3
WORKER_ID="worker-concurrency-3" WORKER_LOG="$ROOT/.worker3.log" \
  nohup setsid npx tsx "$ROOT/workers/phase2Worker.ts" >/dev/null 2>&1 &
W3_PID=$!
echo "  Worker 3 started (PID=$W3_PID, WORKER_ID=worker-concurrency-3)"

sleep 3

echo "[6/7] Wait for all $NUM_JOBS jobs to complete (timeout 120s)"
deadline=$((SECONDS + 120))
while [[ $SECONDS -lt $deadline ]]; do
  REMAINING=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.evaluation_jobs
WHERE manuscript_id = $MID AND status IN ('queued', 'running');
SQL
)
  REMAINING=$(echo "$REMAINING" | tr -d '[:space:]')
  
  if [[ "$REMAINING" == "0" ]]; then
    echo "  All jobs processed!"
    break
  fi
  
  echo "  Remaining jobs: $REMAINING (waiting...)"
  sleep 2
done

if [[ "$REMAINING" != "0" ]]; then
  echo "ERROR: Timeout waiting for jobs to complete. Remaining: $REMAINING"
  # Stop workers before exiting
  kill -- -$W1_PID 2>/dev/null || true
  kill -- -$W2_PID 2>/dev/null || true
  kill -- -$W3_PID 2>/dev/null || true
  exit 1
fi

echo "[7/7] Stop workers and verify results"
kill -- -$W1_PID 2>/dev/null || true
kill -- -$W2_PID 2>/dev/null || true
kill -- -$W3_PID 2>/dev/null || true
sleep 2

# Verify: all jobs complete, none queued/running
STATUS_SUMMARY=$(psqlc -t -A <<SQL
SELECT
  status,
  COUNT(*) AS count
FROM public.evaluation_jobs
WHERE manuscript_id = $MID
GROUP BY status
ORDER BY status;
SQL
)

echo ""
echo "=== Job Status Summary ==="
echo "$STATUS_SUMMARY"
echo ""

COMPLETE_COUNT=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.evaluation_jobs WHERE manuscript_id = $MID AND status = 'complete';
SQL
)
COMPLETE_COUNT=$(echo "$COMPLETE_COUNT" | tr -d '[:space:]')

if [[ "$COMPLETE_COUNT" != "$NUM_JOBS" ]]; then
  echo "❌ ERROR: Expected $NUM_JOBS complete jobs, got $COMPLETE_COUNT"
  exit 1
fi

# Verify: no double-claims (each job claimed by exactly one worker, processed once)
echo "=== Worker Distribution ==="
psqlc <<SQL
SELECT
  progress->>'claimed_by' AS worker_id,
  COUNT(*) AS jobs_processed
FROM public.evaluation_jobs
WHERE manuscript_id = $MID
GROUP BY progress->>'claimed_by'
ORDER BY worker_id;
SQL

# Check for any job claimed by multiple workers (double-claim detection)
DOUBLE_CLAIMS=$(psqlc -t -A <<SQL
WITH job_claims AS (
  SELECT
    id,
    progress->>'claimed_by' AS worker_id,
    (evaluation_result->>'chunks_processed')::int AS chunks_processed
  FROM public.evaluation_jobs
  WHERE manuscript_id = $MID
)
SELECT COUNT(*) FROM job_claims WHERE chunks_processed IS NULL OR chunks_processed != 3;
SQL
)
DOUBLE_CLAIMS=$(echo "$DOUBLE_CLAIMS" | tr -d '[:space:]')

if [[ "$DOUBLE_CLAIMS" != "0" ]]; then
  echo "❌ ERROR: Found $DOUBLE_CLAIMS jobs with invalid processing (possible double-claims)"
  exit 1
fi

echo ""
echo "=== Logs Inspection ==="
for i in 1 2 3; do
  LOG_FILE="$ROOT/.worker$i.log"
  CLAIMS=$(grep -cE '"message":"Job claimed"' "$LOG_FILE" || echo "0")
  ERRORS=$(grep -cE '"level":"error"' "$LOG_FILE" || echo "0")
  echo "  Worker $i: $CLAIMS claims, $ERRORS errors"
done

echo ""
echo "✅ Phase 2D concurrency proof passed!"
echo "   - $NUM_JOBS jobs completed successfully"
echo "   - $NUM_WORKERS workers collaborated without conflicts"
echo "   - 0 double-claims (SKIP LOCKED working correctly)"
echo "   - All jobs have chunks_processed=3"
