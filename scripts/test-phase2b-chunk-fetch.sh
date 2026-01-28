#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspaces/literary-ai-partner"
DB_CONTAINER="supabase_db_literary-ai-partner"
MID=9999

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

echo "== Phase 2B regression: seed manuscript + chunks, queue job, assert result =="

echo "[1/6] Ensure manuscript exists (id=$MID)"
psqlc <<SQL
INSERT INTO public.manuscripts (id, title, work_type, created_by)
VALUES ($MID, 'Test Manuscript for Phase 2B', 'fiction', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
SQL

echo "[2/6] Seed 3 chunks (DELETE-first, deterministic)"
# Choose ONE seed set. Option A gives ~249 chars (your long chunks).
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

SELECT
  manuscript_id,
  COUNT(*) AS chunk_count,
  SUM(char_length(content)) AS total_chars
FROM public.manuscript_chunks
WHERE manuscript_id = 9999
GROUP BY manuscript_id;
SQL

echo "[3/6] Queue a valid job (full_evaluation)"
JOB_ID="$(psqlc -t -A <<SQL
INSERT INTO public.evaluation_jobs (
  manuscript_id,
  job_type,
  status,
  work_type,
  policy_family,
  voice_preservation_level,
  english_variant
)
VALUES (
  $MID,
  'full_evaluation',
  'queued',
  'novel',
  '$POLICY_FAMILY',
  '$VOICE_LEVEL',
  '$ENGLISH_VARIANT'
)
RETURNING id;
SQL
)"
JOB_ID="$(echo "$JOB_ID" | grep -E '^[0-9a-f-]+$' | head -1 | tr -d '[:space:]')"

# Validate UUID format
if ! [[ "$JOB_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "ERROR: bad JOB_ID: $JOB_ID"
  exit 1
fi

echo "Queued jobId=$JOB_ID"

echo "[4/6] Start worker cleanly"
cd "$ROOT"
./scripts/worker-stop.sh >/dev/null 2>&1 || true
pkill -9 -f "phase2Worker" >/dev/null 2>&1 || true
./scripts/release-all-leases.sh >/dev/null 2>&1 || true

# Truncate log to avoid reading historical garbage (dotenv banners, old null-job spam)
: > "$ROOT/.worker.log"

./scripts/worker-start.sh >/dev/null
sleep 2

echo "[5/6] Wait for completion (timeout 60s)"
deadline=$((SECONDS + 60))
status=""
while [[ $SECONDS -lt $deadline ]]; do
  status="$(psqlc -t -A <<SQL
SELECT status
FROM public.evaluation_jobs
WHERE id = '$JOB_ID';
SQL
)"
  status="$(echo "$status" | tr -d '[:space:]')"
  if [[ "$status" == "complete" ]]; then
    break
  fi
  sleep 2
done

if [[ "$status" != "complete" ]]; then
  echo "ERROR: job did not complete in time. status=$status"
  echo "Last worker log lines:"
  tail -80 "$ROOT/.worker.log" || true
  exit 1
fi

echo "[6/6] Assert evaluation_result metrics"
RESULT="$(psqlc -t -A <<SQL
SELECT
  COALESCE((evaluation_result->>'chunks_processed'), '') AS chunks_processed,
  COALESCE((evaluation_result->>'total_chars'), '') AS total_chars,
  COALESCE((evaluation_result->>'simulated'), '') AS simulated,
  COALESCE((evaluation_result->>'message'), '') AS message
FROM public.evaluation_jobs
WHERE id = '$JOB_ID';
SQL
)"

chunks_processed="$(echo "$RESULT" | cut -d'|' -f1 | tr -d '[:space:]')"
total_chars="$(echo "$RESULT" | cut -d'|' -f2 | tr -d '[:space:]')"
simulated="$(echo "$RESULT" | cut -d'|' -f3 | tr -d '[:space:]')"
message="$(echo "$RESULT" | cut -d'|' -f4)"

echo "Result: chunks_processed=$chunks_processed total_chars=$total_chars simulated=$simulated message=\"$message\""

if [[ "$chunks_processed" != "3" ]]; then
  echo "ERROR: expected chunks_processed=3, got $chunks_processed"
  exit 1
fi

if [[ -z "$total_chars" || "$total_chars" -le 0 ]]; then
  echo "ERROR: expected total_chars > 0, got $total_chars"
  exit 1
fi

echo "✅ Phase 2B regression passed."

# Final verification: check log for nulls or fetchJobDetails spam
if grep -qE 'jobId":null|Failed to fetch job details' "$ROOT/.worker.log"; then
  echo "❌ WARNING: Found null jobs or fetchJobDetails errors in log"
  exit 1
fi

echo "✅ Clean logs verified (no null jobs, no redundant fetches)"
# Optional cleanup
./scripts/worker-stop.sh >/dev/null 2>&1 || true
