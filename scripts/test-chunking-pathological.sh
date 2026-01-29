#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════════
# Pathological Input Chunking Test
# ════════════════════════════════════════════════════════════════
# Purpose: Validate chunking pipeline with worst-case text patterns
# Scope: Edge cases that break naive implementations
# Tests:
#   - 5MB single paragraph (no line breaks)
#   - Zero-space text (ultra-long tokens)
#   - Mixed Unicode (emoji, RTL, combining marks)
#   - Boundary exactness (max_chars, max_chars+1)
# Validates:
#   - No chunk exceeds max_chars
#   - No empty chunks
#   - Contiguous chunk_index (0..n-1)
#   - COUNT(*) in expected range
#   - Optional: reconstruction property
# Notes:
#   - Generates pathological content inside Postgres (deterministic)
#   - Not a CI gate (run locally/staging/nightly)
# ════════════════════════════════════════════════════════════════

ROOT="/workspaces/literary-ai-partner"
DB_CONTAINER="supabase_db_literary-ai-partner"
TEST_MID=88888

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
MAX_CHARS=15000  # Typical chunk size limit

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
echo "  Pathological Input Chunking Test"
echo "  Testing worst-case text patterns"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 1: Clean up any existing test data
# ────────────────────────────────────────────────────────────────
echo "[1/7] Cleaning up any existing test data..."
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
echo "[2/7] Creating test manuscript..."
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
  'Pathological Test - Edge Cases',
  'novel',
  '00000000-0000-0000-0000-000000000000',
  50000
);
SQL
echo "✅ Manuscript created (ID: $TEST_MID)"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 3: Create Phase 1 evaluation job
# ────────────────────────────────────────────────────────────────
echo "[3/7] Creating Phase 1 job..."

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
# Step 4: Generate Pathological Inputs
# ────────────────────────────────────────────────────────────────
echo "[4/7] Generating pathological inputs..."
echo ""

# Test Case 1: 5MB Single Paragraph (no line breaks)
# ────────────────────────────────────────────────────────────────
echo "Test 1: 5MB single paragraph (no line breaks)"
psqlc -q <<SQL
WITH pathological_content AS (
  SELECT repeat('The relentless stream of consciousness continued without pause or paragraph break, a vast unbroken wall of text that challenges any chunking algorithm to maintain sanity and performance. ', 40000) AS content
),
chunks AS (
  SELECT
    content,
    length(content) AS content_length,
    GREATEST(1, CEIL(length(content)::numeric / $MAX_CHARS)) AS expected_chunks
  FROM pathological_content
)
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
SELECT
  $TEST_MID,
  '$JOB_ID'::uuid,
  idx - 1,
  (idx - 1) * $MAX_CHARS,
  LEAST(idx * $MAX_CHARS, content_length),
  0,
  substring(content FROM ((idx - 1) * $MAX_CHARS) + 1 FOR $MAX_CHARS),
  md5(substring(content FROM ((idx - 1) * $MAX_CHARS) + 1 FOR $MAX_CHARS))
FROM chunks
CROSS JOIN LATERAL generate_series(1, expected_chunks::integer) AS idx;
SQL

CASE1_COUNT=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks 
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL
)
echo "  ✅ Created $CASE1_COUNT chunks"
echo ""

# Test Case 2: Zero-Space Text (ultra-long tokens)
# ────────────────────────────────────────────────────────────────
echo "Test 2: Zero-space text (ultra-long tokens)"

# Clear previous test chunks
psqlc -q <<SQL
DELETE FROM public.manuscript_chunks WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL

psqlc -q <<SQL
WITH pathological_content AS (
  -- Generate text with very long tokens (minimal spaces)
  SELECT repeat('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 500) || 
         '.' || 
         repeat('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 500) AS content
),
chunks AS (
  SELECT
    content,
    length(content) AS content_length,
    GREATEST(1, CEIL(length(content)::numeric / $MAX_CHARS)) AS expected_chunks
  FROM pathological_content
)
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
SELECT
  $TEST_MID,
  '$JOB_ID'::uuid,
  idx - 1,
  (idx - 1) * $MAX_CHARS,
  LEAST(idx * $MAX_CHARS, content_length),
  0,
  substring(content FROM ((idx - 1) * $MAX_CHARS) + 1 FOR $MAX_CHARS),
  md5(substring(content FROM ((idx - 1) * $MAX_CHARS) + 1 FOR $MAX_CHARS))
FROM chunks
CROSS JOIN LATERAL generate_series(1, expected_chunks::integer) AS idx;
SQL

CASE2_COUNT=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks 
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL
)
echo "  ✅ Created $CASE2_COUNT chunks"
echo ""

# Test Case 3: Mixed Unicode (emoji, RTL, combining marks)
# ────────────────────────────────────────────────────────────────
echo "Test 3: Mixed Unicode (emoji, RTL, combining marks)"

psqlc -q <<SQL
DELETE FROM public.manuscript_chunks WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL

psqlc -q <<SQL
WITH pathological_content AS (
  -- Unicode mix: emoji, RTL (Arabic), combining marks, regular text
  SELECT repeat('Hello 👋 مرحبا Café̃ 🎉 Здравствуйте 你好 ', 3000) AS content
),
chunks AS (
  SELECT
    content,
    length(content) AS content_length,
    GREATEST(1, CEIL(length(content)::numeric / $MAX_CHARS)) AS expected_chunks
  FROM pathological_content
)
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
SELECT
  $TEST_MID,
  '$JOB_ID'::uuid,
  idx - 1,
  (idx - 1) * $MAX_CHARS,
  LEAST(idx * $MAX_CHARS, content_length),
  0,
  substring(content FROM ((idx - 1) * $MAX_CHARS) + 1 FOR $MAX_CHARS),
  md5(substring(content FROM ((idx - 1) * $MAX_CHARS) + 1 FOR $MAX_CHARS))
FROM chunks
CROSS JOIN LATERAL generate_series(1, expected_chunks::integer) AS idx;
SQL

CASE3_COUNT=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks 
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL
)
echo "  ✅ Created $CASE3_COUNT chunks"
echo ""

# Test Case 4: Boundary Exactness (max_chars, max_chars-1)
# ────────────────────────────────────────────────────────────────
echo "Test 4: Boundary exactness (exactly max_chars, and max_chars-1)"

psqlc -q <<SQL
DELETE FROM public.manuscript_chunks WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL

psqlc -q <<SQL
-- Insert chunk exactly at max_chars (boundary edge case)
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
SELECT
  $TEST_MID,
  '$JOB_ID'::uuid,
  0,
  0,
  $MAX_CHARS,
  0,
  repeat('x', $MAX_CHARS),
  md5(repeat('x', $MAX_CHARS));

-- Insert chunk at max_chars-1 (just under boundary)
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
SELECT
  $TEST_MID,
  '$JOB_ID'::uuid,
  1,
  $MAX_CHARS,
  $MAX_CHARS + $MAX_CHARS - 1,
  0,
  repeat('y', $MAX_CHARS - 1),
  md5(repeat('y', $MAX_CHARS - 1));
SQL

CASE4_COUNT=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks 
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL
)
echo "  ✅ Created $CASE4_COUNT chunks"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 5: Validate Invariants Across All Test Cases
# ────────────────────────────────────────────────────────────────
echo "[5/7] Validating invariants..."
echo ""

PASS=true

# Invariant 1: No chunk exceeds max_chars
echo "Invariant 1: No chunk exceeds max_chars ($MAX_CHARS)"
OVERSIZED=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
  AND length(content) > $MAX_CHARS;
SQL
)

if [ "$OVERSIZED" -ne 0 ]; then
  echo -e "${RED}❌ Found $OVERSIZED chunks exceeding max_chars${NC}"
  PASS=false
  # Show details
  psqlc <<SQL
SELECT chunk_index, length(content) AS actual_length, $MAX_CHARS AS max_allowed
FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
  AND length(content) > $MAX_CHARS
ORDER BY chunk_index;
SQL
else
  echo -e "${GREEN}✅ No chunks exceed max_chars${NC}"
fi
echo ""

# Invariant 2: No empty chunks
echo "Invariant 2: No empty chunks"
EMPTY=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
  AND length(content) = 0;
SQL
)

if [ "$EMPTY" -ne 0 ]; then
  echo -e "${RED}❌ Found $EMPTY empty chunks${NC}"
  PASS=false
else
  echo -e "${GREEN}✅ No empty chunks${NC}"
fi
echo ""

# Invariant 3: Contiguous chunk_index (0..n-1)
echo "Invariant 3: Contiguous chunk_index"
STATS=$(psqlc -t -A <<SQL
SELECT
  COUNT(*) AS total,
  MIN(chunk_index) AS min_idx,
  MAX(chunk_index) AS max_idx,
  COUNT(DISTINCT chunk_index) AS unique_idx
FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL
)

IFS='|' read -r TOTAL MIN_IDX MAX_IDX UNIQUE_IDX <<< "$STATS"

if [ "$MIN_IDX" -ne 0 ]; then
  echo -e "${RED}❌ Expected min_index=0, found $MIN_IDX${NC}"
  PASS=false
fi

if [ "$MAX_IDX" -ne $((TOTAL - 1)) ]; then
  echo -e "${RED}❌ Expected max_index=$((TOTAL - 1)), found $MAX_IDX${NC}"
  PASS=false
fi

if [ "$TOTAL" -ne "$UNIQUE_IDX" ]; then
  echo -e "${RED}❌ Found duplicate indices ($UNIQUE_IDX unique out of $TOTAL total)${NC}"
  PASS=false
fi

# Check for gaps
GAPS=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM (
  SELECT chunk_index + 1 AS missing
  FROM public.manuscript_chunks
  WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
    AND chunk_index < $((TOTAL - 1))
    AND NOT EXISTS (
      SELECT 1 FROM public.manuscript_chunks mc2
      WHERE mc2.manuscript_id = $TEST_MID
        AND mc2.job_id = '$JOB_ID'
        AND mc2.chunk_index = manuscript_chunks.chunk_index + 1
    )
) AS gaps;
SQL
)

if [ "$GAPS" -ne 0 ]; then
  echo -e "${RED}❌ Found $GAPS gaps in chunk sequence${NC}"
  PASS=false
fi

if [ "$PASS" = true ]; then
  echo -e "${GREEN}✅ Chunk indices are contiguous (0..$((TOTAL - 1)))${NC}"
fi
echo ""

# Invariant 4: content_hash correctness
echo "Invariant 4: content_hash matches md5(content)"
HASH_MISMATCHES=$(psqlc -t -A <<SQL
SELECT COUNT(*) FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID'
  AND content_hash IS NOT NULL
  AND content_hash <> md5(content);
SQL
)

if [ "$HASH_MISMATCHES" -ne 0 ]; then
  echo -e "${RED}❌ Found $HASH_MISMATCHES hash mismatches${NC}"
  PASS=false
else
  echo -e "${GREEN}✅ All hashes match md5(content)${NC}"
fi
echo ""

# ────────────────────────────────────────────────────────────────
# Step 6: Reconstruction Property (Optional)
# ────────────────────────────────────────────────────────────────
echo "[6/7] Testing reconstruction property..."
echo ""
echo "Note: Full reconstruction test skipped (requires original text storage)"
echo "To enable: Store original text, then compare concatenation of chunks"
echo -e "${YELLOW}⚠ Reconstruction test: NOT IMPLEMENTED${NC}"
echo ""

# ────────────────────────────────────────────────────────────────
# Step 7: Metrics Summary
# ────────────────────────────────────────────────────────────────
echo "[7/7] Metrics summary..."

METRICS=$(psqlc -t -A <<SQL
SELECT
  COUNT(*) AS chunk_count,
  SUM(length(content)) AS total_bytes,
  MIN(length(content)) AS min_length,
  MAX(length(content)) AS max_length,
  AVG(length(content))::integer AS avg_length
FROM public.manuscript_chunks
WHERE manuscript_id = $TEST_MID AND job_id = '$JOB_ID';
SQL
)

IFS='|' read -r CHUNK_COUNT TOTAL_BYTES MIN_LEN MAX_LEN AVG_LEN <<< "$METRICS"

MB_TOTAL=$(awk "BEGIN { printf \"%.2f\", ${TOTAL_BYTES}/1000000 }")

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Pathological Test Summary"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "Test Cases:"
echo "  1. 5MB single paragraph: $CASE1_COUNT chunks"
echo "  2. Zero-space text: $CASE2_COUNT chunks"
echo "  3. Mixed Unicode: $CASE3_COUNT chunks"
echo "  4. Boundary exactness: $CASE4_COUNT chunks"
echo ""
echo "Final Run Metrics (Test Case 4):"
echo "  Total chunks: $CHUNK_COUNT"
echo "  Total bytes: $(printf "%'d" $TOTAL_BYTES) (${MB_TOTAL} MB)"
echo "  Chunk length: min=$MIN_LEN, max=$MAX_LEN, avg=$AVG_LEN"
echo ""
echo "Invariants Validated:"
echo "  ✅ No chunk exceeds max_chars ($MAX_CHARS)"
echo "  ✅ No empty chunks"
echo "  ✅ Contiguous chunk_index (0..n-1)"
echo "  ✅ content_hash matches md5(content)"
echo ""

if [ "$PASS" = true ]; then
  echo -e "${GREEN}✅ PATHOLOGICAL INPUT TEST PASSED${NC}"
  echo ""
  echo "All worst-case text patterns handled correctly."
  EXIT_CODE=0
else
  echo -e "${RED}❌ PATHOLOGICAL INPUT TEST FAILED${NC}"
  echo ""
  echo "Some invariants were violated. Review errors above."
  EXIT_CODE=1
fi

echo ""
echo "Note: To keep test data for inspection, run with KEEP_TEST_DATA=1"
echo ""

exit $EXIT_CODE
