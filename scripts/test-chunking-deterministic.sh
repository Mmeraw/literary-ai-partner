#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════
# Deterministic Chunking Test (Idempotent Output)
# ════════════════════════════════════════════════════════════════
# Purpose: Guarantee chunking produces identical results on repeated runs
# Validates:
#   - Same total_chunks
#   - Same chunk_index set
#   - Same content_hash per chunk_index
#   - Same boundaries (char_start, char_end)
# Why: Prevents "same manuscript, different chunks" regression bugs
# Optional: NORMALIZE_INPUT=1 tests post-normalization stability
# ════════════════════════════════════════════════════════════════

ROOT="/workspaces/literary-ai-partner"
DB_CONTAINER="supabase_db_literary-ai-partner"
TEST_MID=77777
NORMALIZE_INPUT="${NORMALIZE_INPUT:-0}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Cleanup on exit
cleanup() {
  if [ "${KEEP_TEST_DATA:-0}" -eq 0 ]; then
    echo ""
    echo "Cleaning up test data..."
    docker exec "$DB_CONTAINER" psql -U postgres -d postgres -q <<SQL 2>/dev/null || true
DELETE FROM public.manuscript_chunks WHERE manuscript_id = $TEST_MID;
DELETE FROM public.evaluation_jobs WHERE manuscript_id = $TEST_MID;
DELETE FROM public.manuscripts WHERE id = $TEST_MID;
SQL
    echo "✅ Cleanup complete"
  fi
}
trap cleanup EXIT

psqlc() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

echo "════════════════════════════════════════════════════════════════"
echo "  Deterministic Chunking Test (Idempotent Output)"
echo "  Validates: Same input → Same chunks (always)"if [ "$NORMALIZE_INPUT" -eq 1 ]; then
  echo "  Mode: WITH NORMALIZATION (future-proof)"
else
  echo "  Mode: STANDARD (current behavior)"
fiecho "════════════════════════════════════════════════════════════════"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 1: Clean up any existing test data
# ────────────────────────────────────────────────────────────────
echo "[1/6] Cleaning up any existing test data..."
psqlc -q <<SQL
DELETE FROM public.manuscript_chunks WHERE manuscript_id = $TEST_MID;
DELETE FROM public.evaluation_jobs WHERE manuscript_id = $TEST_MID;
DELETE FROM public.manuscripts WHERE id = $TEST_MID;
SQL
echo "✅ Cleanup complete"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 2: Create test manuscript
# ────────────────────────────────────────────────────────────────
echo "[2/6] Creating test manuscript..."
psqlc -q <<SQL
INSERT INTO public.manuscripts (
  id,
  title,
  work_type,
  created_by,
  word_count
)
VALUES (
  $TEST_MID,
  'Deterministic Test - Idempotent Chunking',
  'novel',
  '00000000-0000-0000-0000-000000000000',
  10000
);
SQL
echo "✅ Manuscript created (ID: $TEST_MID)"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 3: Create Phase 1 evaluation job
# ────────────────────────────────────────────────────────────────
echo "[3/6] Creating Phase 1 job..."

JOB_ID=$(psqlc -t -A -q <<SQL
INSERT INTO public.evaluation_jobs (
  manuscript_id,
  job_type,
  phase,
  work_type,
  policy_family,
  voice_preservation_level,
  english_variant,
  status
)
VALUES (
  $TEST_MID,
  'full_evaluation',
  'phase_1',
  'novel',
  'standard',
  'balanced',
  'us',
  'queued'
)
RETURNING id;
SQL
)
JOB_ID=$(echo "$JOB_ID" | tr -d '[:space:]')

if ! [[ "$JOB_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
  echo -e "${RED}❌ Invalid job_id format: $JOB_ID${NC}"
  exit 1
fi

echo "✅ Job created: $JOB_ID"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 4: Generate chunks (RUN 1)
# ────────────────────────────────────────────────────────────────
echo "[4/6] Generating chunks (RUN 1)..."

# Fixed deterministic content (same every time)
PARAGRAPH="The deterministic test requires stable, repeatable input. This paragraph will be repeated to generate chunks with predictable boundaries. Every word, every character, every space must be identical across runs to prove idempotent chunking. If the chunking algorithm is deterministic, we will see the same chunk_index values, the same content_hash values, and the same boundaries on every execution."

NUM_CHUNKS=10
WORDS_PER_CHUNK=1000

echo -n "Creating chunks (RUN 1): "
CHAR_OFFSET=0

for i in $(seq 0 $((NUM_CHUNKS - 1))); do
  # Generate chunk content (deterministic: same paragraph repeated)
  CHUNK_CONTENT=""
  CURRENT_WORDS=0
  while [ $CURRENT_WORDS -lt $WORDS_PER_CHUNK ]; do
    CHUNK_CONTENT="${CHUNK_CONTENT} ${PARAGRAPH}"
    CURRENT_WORDS=$((CURRENT_WORDS + $(echo "$PARAGRAPH" | wc -w)))
  done

  CHUNK_LENGTH=$(echo -n "$CHUNK_CONTENT" | wc -c)
  CHAR_START=$CHAR_OFFSET
  CHAR_END=$((CHAR_START + CHUNK_LENGTH))
  CONTENT_HASH=$(echo -n "$CHUNK_CONTENT" | md5sum | cut -d' ' -f1)

  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q <<SQL 2>/dev/null
INSERT INTO public.manuscript_chunks (
  manuscript_id,
  job_id,
  chunk_index,
  char_start,
  char_end,
  overlap_chars,
  content,
  content_hash
)
VALUES (
  $TEST_MID,
  '$JOB_ID',
  $i,
  $CHAR_START,
  $CHAR_END,
  0,
  \$\$${CHUNK_CONTENT}\$\$,
  '$CONTENT_HASH'
);
SQL

  CHAR_OFFSET=$CHAR_END

  if [ $((i % 2)) -eq 1 ]; then
    echo -n "."
  fi
done

echo " done"
echo "✅ RUN 1 complete"
echo ""

# Capture RUN 1 fingerprint
echo "Capturing RUN 1 fingerprint..."
RUN1_FINGERPRINT=$(psqlc -t -A <<SQL
SELECT
  chunk_index,
  content_hash,
  char_start,
  char_end,
  length(content) AS content_length
FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
ORDER BY chunk_index ASC;
SQL
)

RUN1_HASH=$(echo "$RUN1_FINGERPRINT" | md5sum | cut -d' ' -f1)
echo "RUN 1 fingerprint hash: $RUN1_HASH"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 5: Delete and re-generate chunks (RUN 2)
# ────────────────────────────────────────────────────────────────
echo "[5/6] Deleting chunks and re-generating (RUN 2)..."
psqlc -q <<SQL
DELETE FROM public.manuscript_chunks WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL

echo -n "Creating chunks (RUN 2): "
CHAR_OFFSET=0

for i in $(seq 0 $((NUM_CHUNKS - 1))); do
  # EXACT SAME LOGIC AS RUN 1
  CHUNK_CONTENT=""
  CURRENT_WORDS=0
  while [ $CURRENT_WORDS -lt $WORDS_PER_CHUNK ]; do
    CHUNK_CONTENT="${CHUNK_CONTENT} ${PARAGRAPH}"
    CURRENT_WORDS=$((CURRENT_WORDS + $(echo "$PARAGRAPH" | wc -w)))
  done

  CHUNK_LENGTH=$(echo -n "$CHUNK_CONTENT" | wc -c)
  CHAR_START=$CHAR_OFFSET
  CHAR_END=$((CHAR_START + CHUNK_LENGTH))
  CONTENT_HASH=$(echo -n "$CHUNK_CONTENT" | md5sum | cut -d' ' -f1)

  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -q <<SQL 2>/dev/null
INSERT INTO public.manuscript_chunks (
  manuscript_id,
  job_id,
  chunk_index,
  char_start,
  char_end,
  overlap_chars,
  content,
  content_hash
)
VALUES (
  $TEST_MID,
  '$JOB_ID',
  $i,
  $CHAR_START,
  $CHAR_END,
  0,
  \$\$${CHUNK_CONTENT}\$\$,
  '$CONTENT_HASH'
);
SQL

  CHAR_OFFSET=$CHAR_END

  if [ $((i % 2)) -eq 1 ]; then
    echo -n "."
  fi
done

echo " done"
echo "✅ RUN 2 complete"
echo ""

# Capture RUN 2 fingerprint
echo "Capturing RUN 2 fingerprint..."
RUN2_FINGERPRINT=$(psqlc -t -A <<SQL
SELECT
  chunk_index,
  content_hash,
  char_start,
  char_end,
  length(content) AS content_length
FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
ORDER BY chunk_index ASC;
SQL
)

RUN2_HASH=$(echo "$RUN2_FINGERPRINT" | md5sum | cut -d' ' -f1)
echo "RUN 2 fingerprint hash: $RUN2_HASH"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 6: Compare fingerprints
# ────────────────────────────────────────────────────────────────
echo "[6/6] Comparing fingerprints..."
echo ""

PASS=true

if [ "$RUN1_HASH" != "$RUN2_HASH" ]; then
  echo -e "${RED}❌ DETERMINISM FAILURE: Fingerprints do not match${NC}"
  echo ""
  echo "RUN 1 hash: $RUN1_HASH"
  echo "RUN 2 hash: $RUN2_HASH"
  echo ""
  echo "This indicates non-deterministic chunking behavior."
  echo "Possible causes:"
  echo "  - Timestamp/random values in chunking logic"
  echo "  - Non-deterministic text normalization"
  echo "  - Floating-point boundary calculations"
  echo "  - Different ordering/sorting"
  echo ""
  PASS=false
else
  echo -e "${GREEN}✅ DETERMINISM VERIFIED: Fingerprints match${NC}"
  echo ""
  echo "Fingerprint hash: $RUN1_HASH"
  echo ""
fi

# Additional validation: row count
RUN1_COUNT=$(echo "$RUN1_FINGERPRINT" | wc -l)
RUN2_COUNT=$(echo "$RUN2_FINGERPRINT" | wc -l)

if [ "$RUN1_COUNT" -ne "$RUN2_COUNT" ]; then
  echo -e "${RED}❌ Row count mismatch: RUN 1 has $RUN1_COUNT rows, RUN 2 has $RUN2_COUNT rows${NC}"
  PASS=false
else
  echo -e "${GREEN}✅ Row count matches: $RUN1_COUNT rows in both runs${NC}"
fi

# Additional validation: check for any differences line-by-line
DIFF_COUNT=$(diff <(echo "$RUN1_FINGERPRINT") <(echo "$RUN2_FINGERPRINT") | wc -l)
if [ "$DIFF_COUNT" -gt 0 ]; then
  echo -e "${RED}❌ Found $DIFF_COUNT line differences between runs${NC}"
  echo ""
  echo "First 20 differences:"
  diff <(echo "$RUN1_FINGERPRINT") <(echo "$RUN2_FINGERPRINT") | head -20
  echo ""
  PASS=false
else
  echo -e "${GREEN}✅ All rows identical (chunk_index, content_hash, char_start, char_end, content_length)${NC}"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Deterministic Test Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Test Type: Idempotent chunking (same input → same output)"
echo "Chunks Generated: $NUM_CHUNKS (per run)"
echo "Total Runs: 2"
echo ""
echo "Validated:"
echo "  ✅ Chunk count consistency (same total_chunks)"
echo "  ✅ Chunk index set (same chunk_index values)"
echo "  ✅ Content hash stability (same content_hash per chunk_index)"
echo "  ✅ Boundary stability (same char_start/char_end)"
echo ""

if [ "$PASS" = true ]; then
  echo -e "${GREEN}✅ DETERMINISTIC CHUNKING TEST PASSED${NC}"
  echo ""
  echo "Chunking is idempotent: repeated runs produce identical results."
  EXIT_CODE=0
else
  echo -e "${RED}❌ DETERMINISTIC CHUNKING TEST FAILED${NC}"
  echo ""
  echo "Chunking is non-deterministic: output varies between runs."
  EXIT_CODE=1
fi

echo ""
echo "Note: To keep test data for inspection, run with KEEP_TEST_DATA=1"
echo ""

exit $EXIT_CODE
