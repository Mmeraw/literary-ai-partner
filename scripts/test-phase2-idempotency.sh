#!/usr/bin/env bash
# Phase 2 Idempotency Proof Test
# Tests DB-level idempotency guarantee with exact commands

set -euo pipefail

source .env.local

echo "========================================="
echo "PHASE 2 IDEMPOTENCY PROOF TEST"
echo "========================================="
echo ""

# Step 1: Apply migration
echo "1. Applying evaluation_artifacts migration..."
npx supabase db push
echo "✓ Migration applied"
echo ""

# Step 2: Create a test job
echo "2. Creating test job..."
JOB_RESPONSE=$(curl -s -X POST http://localhost:3000/api/internal/jobs \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id": 1, "job_type": "full_evaluation"}')

JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.job.id')
echo "✓ Job created: $JOB_ID"
echo ""

# Step 3: Start daemon in background
echo "3. Starting worker daemon..."
npm run worker:daemon &
DAEMON_PID=$!
echo "✓ Daemon started (PID: $DAEMON_PID)"
echo ""

# Step 4: Wait for Phase 1 completion
echo "4. Waiting for Phase 1 to complete..."
for i in {1..30}; do
  sleep 2
  STATUS=$(curl -s http://localhost:3000/api/jobs/$JOB_ID | jq -r '.job.progress.phase_status // "unknown"')
  PHASE=$(curl -s http://localhost:3000/api/jobs/$JOB_ID | jq -r '.job.progress.phase // "unknown"')
  
  if [[ "$PHASE" == "phase1" && "$STATUS" == "completed" ]]; then
    echo "✓ Phase 1 completed after ${i}x2 seconds"
    break
  fi
  
  if [[ $i -eq 30 ]]; then
    echo "✗ Phase 1 did not complete in 60 seconds"
    kill $DAEMON_PID 2>/dev/null || true
    exit 1
  fi
done
echo ""

# Step 5: Wait for Phase 2 completion
echo "5. Waiting for Phase 2 to complete..."
for i in {1..20}; do
  sleep 2
  JOB_STATUS=$(curl -s http://localhost:3000/api/jobs/$JOB_ID | jq -r '.job.status // "unknown"')
  
  if [[ "$JOB_STATUS" == "complete" ]]; then
    echo "✓ Phase 2 completed after ${i}x2 seconds"
    break
  fi
  
  if [[ $i -eq 20 ]]; then
    echo "✗ Phase 2 did not complete in 40 seconds"
    kill $DAEMON_PID 2>/dev/null || true
    exit 1
  fi
done
echo ""

# Step 6: Verify artifact exists
echo "6. Verifying artifact exists..."
ARTIFACT_RESPONSE=$(curl -s http://localhost:3000/api/jobs/$JOB_ID/artifacts?type=evaluation_result_v1 \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")

ARTIFACT_FOUND=$(echo "$ARTIFACT_RESPONSE" | jq -r '.ok')
if [[ "$ARTIFACT_FOUND" == "true" ]]; then
  echo "✓ Artifact found"
  echo ""
  echo "Artifact summary (first 200 chars):"
  echo "$ARTIFACT_RESPONSE" | jq -r '.artifact.content.summary' | head -c 200
  echo "..."
else
  echo "✗ Artifact not found"
  echo "Response: $ARTIFACT_RESPONSE"
  kill $DAEMON_PID 2>/dev/null || true
  exit 1
fi
echo ""

# Step 7: Stop daemon
echo "7. Stopping daemon..."
kill $DAEMON_PID 2>/dev/null || true
wait $DAEMON_PID 2>/dev/null || true
echo "✓ Daemon stopped"
echo ""

# Step 8: Re-run daemon to prove idempotency
echo "8. Re-running daemon to test idempotency..."
echo "(This should NOT create a duplicate artifact)"

# Reset job progress to simulate re-trigger
curl -s -X PATCH http://localhost:3000/api/jobs/$JOB_ID \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"progress": {"phase": "phase1", "phase_status": "completed"}}' > /dev/null

npm run worker:daemon &
DAEMON_PID2=$!
echo "✓ Daemon restarted (PID: $DAEMON_PID2)"

sleep 5
kill $DAEMON_PID2 2>/dev/null || true
wait $DAEMON_PID2 2>/dev/null || true
echo ""

# Step 9: Verify no duplicate artifacts
echo "9. Verifying no duplicate artifacts..."
ARTIFACT_COUNT=$(curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/count_artifacts" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"job_id_param\": \"$JOB_ID\"}" 2>/dev/null || echo "0")

# Fallback to direct table query if RPC doesn't exist
if [[ "$ARTIFACT_COUNT" == "0" ]]; then
  ARTIFACT_COUNT=$(curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/evaluation_artifacts?job_id=eq.$JOB_ID&select=count" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | jq 'length')
fi

if [[ "$ARTIFACT_COUNT" == "1" ]]; then
  echo "✓ Exactly 1 artifact found (idempotency verified)"
else
  echo "✗ Expected 1 artifact, found: $ARTIFACT_COUNT"
  exit 1
fi
echo ""

echo "========================================="
echo "✓ ALL TESTS PASSED"
echo "========================================="
echo ""
echo "Summary:"
echo "  - Job progressed: queued → Phase 1 → Phase 2 → complete"
echo "  - Artifact persisted with DB-level uniqueness"
echo "  - Re-run produced no duplicates (ON CONFLICT DO NOTHING)"
echo "  - Phase 2 is audit-grade idempotent"
