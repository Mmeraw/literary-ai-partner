#!/usr/bin/env bash
# Phase 2 Vertical Slice Proof - Comprehensive End-to-End Test
# Tests all requirements: Phase 1 → Phase 2 → Artifact creation → Idempotency
#
# EXPECTED OUTPUT:
# ✓ Job created: <uuid>
# ✓ Daemon started
# ✓ Phase 1 complete - Phase 2 eligible count: 1
# ✓ Phase 1 output present: X/Y chunks with result_json
# ✓ Job complete
# ✓ Artifact found via API (Overall Score: X.X)
# ✓ Exactly 1 artifact found (idempotency verified at DB level)
# ✓✓✓ ALL TESTS PASSED ✓✓✓

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "PHASE 2 VERTICAL SLICE PROOF"
echo "========================================="
echo ""

# Support BASE_URL for custom ports (e.g., BASE_URL=http://localhost:3015 bash test.sh)
if [[ -n "${BASE_URL:-}" ]]; then
  echo "Using BASE_URL: $BASE_URL"
else
  # Detect port from running dev server
  DEV_PORT=3002
  if ! curl -s http://localhost:$DEV_PORT > /dev/null; then
    DEV_PORT=3000
    if ! curl -s http://localhost:$DEV_PORT > /dev/null; then
      echo -e "${RED}✗ Dev server not running on port 3000 or 3002${NC}"
      echo "Start with: npm run dev"
      echo "Or set BASE_URL: BASE_URL=http://localhost:3015 bash $0"
      exit 1
    fi
  fi
  BASE_URL="http://localhost:$DEV_PORT"
  echo "Using dev server: $BASE_URL"
fi

# Check prerequisites
if [[ ! -f .env.local ]]; then
  echo -e "${RED}✗ .env.local not found${NC}"
  exit 1
fi

source .env.local

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo -e "${RED}✗ SUPABASE_SERVICE_ROLE_KEY not set${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Prerequisites OK${NC}"
echo ""

# Step 1: Create job
echo "[1/8] Creating job..."
JOB_RESPONSE=$(curl -s -X POST "$BASE_URL/api/internal/jobs" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 1, "job_type": "full_evaluation"}')

JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job.id // empty')

if [[ -z "$JOB_ID" ]]; then
  echo -e "${RED}✗ Failed to create job${NC}"
  echo "Response: $JOB_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Job created: $JOB_ID${NC}"
echo ""

# Step 2: Start daemon
echo "[2/8] Starting worker daemon..."
node scripts/worker-daemon.mjs > /tmp/daemon-$JOB_ID.log 2>&1 &
DAEMON_PID=$!
echo -e "${GREEN}✓ Daemon started (PID: $DAEMON_PID)${NC}"
echo "  Log: /tmp/daemon-$JOB_ID.log"
sleep 2
echo ""

# Step 3: Wait for Phase 1 to complete
echo "[3/8] Waiting for Phase 1 to complete..."
PHASE1_COMPLETE=false
for i in {1..60}; do  # Increased to 120s (60x2s) for LLM processing
  sleep 2
  
  ELIGIBILITY=$(curl -s http://localhost:$DEV_PORT/api/internal/jobs \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" 2>/dev/null || echo '{}')
  
  PHASE1_ELIGIBLE=$(echo "$ELIGIBILITY" | jq -r '.summary.phase1_eligible // 0')
  PHASE2_ELIGIBLE=$(echo "$ELIGIBILITY" | jq -r '.summary.phase2_eligible // 0')
  
  if [[ "$PHASE2_ELIGIBLE" -gt 0 ]]; then
    echo -e "${GREEN}✓ Phase 1 complete - Phase 2 eligible count: $PHASE2_ELIGIBLE (after ${i}x2s)${NC}"
    PHASE1_COMPLETE=true
    break
  fi
  
  # Show progress every 10 seconds
  if [[ $((i % 5)) -eq 0 ]]; then
    echo "  [${i}x2s] phase1_eligible: $PHASE1_ELIGIBLE, phase2_eligible: $PHASE2_ELIGIBLE"
  fi
done

if [[ "$PHASE1_COMPLETE" != "true" ]]; then
  echo -e "${RED}✗ Phase 1 did not complete in 120s${NC}"
  echo "Final state: phase1_eligible=$PHASE1_ELIGIBLE, phase2_eligible=$PHASE2_ELIGIBLE"
  kill $DAEMON_PID 2>/dev/null || true
  echo "Check daemon log: /tmp/daemon-$JOB_ID.log"
  exit 1
fi
echo ""

# Step 4: Verify Phase 1 output exists in manuscript_chunks
echo "[4/8] Verifying Phase 1 output in manuscript_chunks..."
CHUNK_COUNT=$(psqlc -t -A <<SQL
SELECT COUNT(*) 
FROM public.manuscript_chunks 
WHERE manuscript_id = $MID AND job_id = '$JOB_ID';
SQL
)

if [ "$CHUNK_COUNT" -gt 0 ]; then
  echo "✅ Found $CHUNK_COUNT chunks for job $JOB_ID"
else
  echo -e "${RED}❌ No chunks found for job $JOB_ID${NC}"
  exit 1
fi
echo ""

# Step 5: Wait for Phase 2 completion
echo "[5/8] Waiting for Phase 2 to complete..."
JOB_COMPLETE=false
for i in {1..60}; do  # 120s for Phase 2 (includes LLM time)
  sleep 2
  
  JOB_STATUS_JSON=$(curl -s -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" "$BASE_URL/api/internal/jobs/$JOB_ID" 2>/dev/null || echo '{}')
  JOB_STATUS=$(echo "$JOB_STATUS_JSON" | jq -r '.job.status // "unknown"')
  
  # Debug: show raw response on first check
  if [[ $i -eq 1 ]]; then
    echo "  DEBUG first poll response: $(echo "$JOB_STATUS_JSON" | jq -c '{status: .job.status, phase: .job.progress.phase, phase_status: .job.progress.phase_status}')"
  fi
  
  if [[ "$JOB_STATUS" == "complete" ]]; then
    echo -e "${GREEN}✓ Job complete (after ${i}x2s)${NC}"
    JOB_COMPLETE=true
    break
  fi
  
  # Show progress every 10 seconds
  if [[ $((i % 5)) -eq 0 ]]; then
    PHASE=$(echo "$JOB_STATUS_JSON" | jq -r '.job.progress.phase // "unknown"')
    PHASE_STATUS=$(echo "$JOB_STATUS_JSON" | jq -r '.job.progress.phase_status // "unknown"')
      MESSAGE=$(echo "$JOB_STATUS_JSON" | jq -r '.job.progress.message // ""')
    echo "  [${i}x2s] status: $JOB_STATUS, phase: $PHASE, phase_status: $PHASE_STATUS - $MESSAGE"
  fi
done

if [[ "$JOB_COMPLETE" != "true" ]]; then
  echo -e "${RED}✗ Job did not complete in 120s (status: $JOB_STATUS)${NC}"
  echo "Final state:"
  echo "$JOB_STATUS_JSON" | jq '{status: .job.status, phase: .job.progress.phase, phase_status: .job.progress.phase_status, message: .job.progress.message}'
  kill $DAEMON_PID 2>/dev/null || true
  echo "Check daemon log: /tmp/daemon-$JOB_ID.log"
  echo "Check dev server log: $(ls -1t /tmp/dev-*.log 2>/dev/null | head -1) (last 50 lines)"
  tail -50 "$(ls -1t /tmp/dev-*.log 2>/dev/null | head -1)" 2>/dev/null || echo "No dev log found"
  exit 1
fi
echo ""

# Step 6: Verify artifact exists via GET endpoint
echo "[6/8] Verifying artifact via GET /api/jobs/:id/artifacts..."
ARTIFACT_JSON=$(curl -s "$BASE_URL/api/jobs/$JOB_ID/artifacts?type=one_page_summary" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

ARTIFACT_OK=$(echo "$ARTIFACT_JSON" | jq -r '.ok // false')

if [[ "$ARTIFACT_OK" == "true" ]]; then
  echo -e "${GREEN}✓ Artifact found via API${NC}"
  
  # Show summary preview
  SUMMARY_PREVIEW=$(echo "$ARTIFACT_JSON" | jq -r '.artifact.content.summary // "N/A"' | head -c 150)
  OVERALL_SCORE=$(echo "$ARTIFACT_JSON" | jq -r '.artifact.content.overall_score // "N/A"')
  
  echo "  Overall Score: $OVERALL_SCORE"
  echo "  Summary Preview:"
  echo "  ${SUMMARY_PREVIEW}..."
else
  echo -e "${RED}✗ Artifact not found${NC}"
  echo "Response: $ARTIFACT_JSON"
  kill $DAEMON_PID 2>/dev/null || true
  exit 1
fi
echo ""

# Step 7: Stop daemon
echo "[7/8] Stopping daemon..."
kill $DAEMON_PID 2>/dev/null || true
wait $DAEMON_PID 2>/dev/null || true
echo -e "${GREEN}✓ Daemon stopped${NC}"
sleep 1
echo ""

# Step 8: Re-run daemon to test idempotency
echo "[8/8] Testing idempotency (re-run daemon)..."
echo "  Re-running daemon for 10 seconds..."

npm run worker:daemon > /tmp/daemon-$JOB_ID-rerun.log 2>&1 &
DAEMON_PID2=$!
sleep 10
kill $DAEMON_PID2 2>/dev/null || true
wait $DAEMON_PID2 2>/dev/null || true

echo -e "${GREEN}✓ Re-run complete${NC}"
echo ""

# Step 9: Verify no duplicate artifacts
echo "[9/8] Verifying no duplicate artifacts..."
ARTIFACT_COUNT_QUERY="${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/evaluation_artifacts?job_id=eq.$JOB_ID&select=id"
ARTIFACT_LIST=$(curl -s "$ARTIFACT_COUNT_QUERY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

ARTIFACT_COUNT=$(echo "$ARTIFACT_LIST" | jq 'length')

if [[ "$ARTIFACT_COUNT" == "1" ]]; then
  echo -e "${GREEN}✓ Exactly 1 artifact found (idempotency verified at DB level)${NC}"
elif [[ "$ARTIFACT_COUNT" == "0" ]]; then
  echo -e "${RED}✗ No artifacts found (unexpected)${NC}"
  exit 1
else
  echo -e "${RED}✗ Expected 1 artifact, found: $ARTIFACT_COUNT${NC}"
  echo "Artifacts: $ARTIFACT_LIST"
  exit 1
fi
echo ""

echo "========================================="
echo -e "${GREEN}✓✓✓ ALL TESTS PASSED ✓✓✓${NC}"
echo "========================================="
echo ""
echo "Verified:"
echo "  ✓ Job created and processed end-to-end"
echo "  ✓ Phase 1 completed (phase2_eligible > 0 observed)"
echo "  ✓ Phase 1 output present in manuscript_chunks (job_id linkage)"
echo "  ✓ Phase 2 completed (job status = complete)"
echo "  ✓ Artifact exists and readable via API"
echo "  ✓ Re-run produced no duplicates (DB-level idempotency)"
echo ""
echo "Job ID: $JOB_ID"
echo "Logs: /tmp/daemon-$JOB_ID.log, /tmp/daemon-$JOB_ID-rerun.log"
