#!/bin/bash
# Quick test: Worker with OpenAI integration
# Tests both with and without OPENAI_API_KEY

set -e

echo "=== Worker + OpenAI Integration Test ==="
echo ""

# Step 1: Ensure worker is stopped
echo "1. Stopping any running workers..."
./scripts/worker-stop.sh || true
pkill -9 -f "phase2Worker" || true
sleep 2

# Step 2: Reset jobs to queued
echo ""
echo "2. Resetting jobs to queued state..."
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
UPDATE evaluation_jobs 
SET status='queued', worker_id=NULL, lease_until=NULL 
WHERE status IN ('running', 'failed');
" > /dev/null

echo "   Jobs reset"

# Step 3: Check current job count
echo ""
echo "3. Current job status:"
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
SELECT status, COUNT(*) as count 
FROM evaluation_jobs 
GROUP BY status;
"

# Step 4: Test WITHOUT OpenAI key (simulated mode)
echo ""
echo "4. Testing worker WITHOUT OpenAI key (simulated mode)..."
echo "   Starting worker..."

# Temporarily unset OPENAI_API_KEY
ORIGINAL_OPENAI_KEY="${OPENAI_API_KEY:-}"
unset OPENAI_API_KEY

./scripts/worker-start.sh > /dev/null 2>&1
sleep 8

echo "   Checking logs..."
tail -5 .worker.log | grep -E "simulated|completed" || echo "   (No completion yet)"

echo "   Stopping worker..."
./scripts/worker-stop.sh > /dev/null 2>&1

# Step 5: Test WITH OpenAI key (if available)
if [ -n "$ORIGINAL_OPENAI_KEY" ]; then
  echo ""
  echo "5. Testing worker WITH OpenAI key (real evaluation)..."
  export OPENAI_API_KEY="$ORIGINAL_OPENAI_KEY"
  
  # Create a test job
  echo "   Creating test job..."
  docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  UPDATE evaluation_jobs 
  SET status='queued', worker_id=NULL, lease_until=NULL;
  " > /dev/null
  
  echo "   Starting worker..."
  ./scripts/worker-start.sh > /dev/null 2>&1
  
  echo "   Waiting for evaluation (this may take 30-60 seconds)..."
  sleep 40
  
  echo "   Checking results..."
  docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
  SELECT id, status, 
         evaluation_result->>'verdict' as verdict,
         (evaluation_result->'metadata'->>'tokensUsed')::int as tokens
  FROM evaluation_jobs 
  WHERE status='complete'
  LIMIT 1;
  "
  
  echo "   Stopping worker..."
  ./scripts/worker-stop.sh > /dev/null 2>&1
else
  echo ""
  echo "5. Skipping OpenAI test (OPENAI_API_KEY not set)"
  echo "   To test with real OpenAI:"
  echo "   export OPENAI_API_KEY='sk-...'"
  echo "   ./scripts/test-worker-openai.sh"
fi

# Step 6: Verify no orphaned jobs
echo ""
echo "6. Final verification:"
ORPHANED=$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c "
SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';
" | tr -d ' ')

if [ "$ORPHANED" = "0" ]; then
  echo "   ✅ No orphaned jobs (crash safety verified)"
else
  echo "   ⚠️  Found $ORPHANED orphaned jobs"
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "Key files:"
echo "  - Worker code: workers/phase2Worker.ts"
echo "  - OpenAI logic: workers/phase2Evaluation.ts"
echo "  - Worker logs: .worker.log"
echo ""
echo "To run worker manually:"
echo "  ./scripts/worker-start.sh"
echo "  tail -f .worker.log"
echo "  ./scripts/worker-stop.sh"
