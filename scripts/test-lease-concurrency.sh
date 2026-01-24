#!/bin/bash
set -e

# Load environment
source .env.local

# Create fresh job
echo "Creating fresh job..."
TEST_JOB=$(curl -s -X POST "http://localhost:3002/api/internal/jobs" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"manuscript_id":"2","job_type":"evaluate_quick"}' | jq -r '.job.id')

echo "Created JOB_ID=$TEST_JOB"
echo ""
echo "Launching 3 concurrent workers..."
echo ""

# Export variables so subshells inherit them
export JOB_ID=$TEST_JOB
export NEXT_PUBLIC_SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY

# Launch 3 workers simultaneously
WORKER_ID=worker-1 node scripts/test-worker-lease.mjs &
WORKER_ID=worker-2 node scripts/test-worker-lease.mjs &
WORKER_ID=worker-3 node scripts/test-worker-lease.mjs &

# Wait for all to complete
wait

echo ""
echo "All workers completed"
