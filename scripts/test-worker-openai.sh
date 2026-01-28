#!/bin/bash
# Quick test: Worker with OpenAI integration
set -e

echo "=== Worker + OpenAI Integration Test ==="
echo "1. Stopping any running workers..."
./scripts/worker-stop.sh || true
sleep 2

echo "2. Resetting jobs..."
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "UPDATE evaluation_jobs SET status='queued', worker_id=NULL, lease_until=NULL;" > /dev/null

echo "3. Starting worker (simulated mode, no OpenAI key)..."
./scripts/worker-start.sh > /dev/null 2>&1
sleep 8

echo "4. Checking logs..."
tail -10 .worker.log

echo "5. Stopping worker..."
./scripts/worker-stop.sh > /dev/null 2>&1

echo "✅ Test complete"
