#!/bin/bash
# Phase 2A Hardening Verification Test
# Tests process group management, environment determinism, and lease reset

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Phase 2A: Worker Hardening Verification Test           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Environment Determinism
echo "🧪 Test 1: Environment Loading (should use .env.staging.local)"
echo "─────────────────────────────────────────────────────────────────"
./scripts/release-all-leases.sh > /dev/null 2>&1
./scripts/worker-start.sh > /dev/null 2>&1
sleep 5
if tail -10 .worker.log | grep -q ".env.staging.local"; then
  echo "✅ PASS: Worker loading .env.staging.local"
else
  echo "❌ FAIL: Worker not loading .env.staging.local"
  tail -20 .worker.log
  exit 1
fi
./scripts/worker-stop.sh > /dev/null 2>&1
sleep 2
echo ""

# Test 2: Process Group Management
echo "🧪 Test 2: Process Group Cleanup (should kill entire tree)"
echo "─────────────────────────────────────────────────────────────────"
./scripts/worker-start.sh > /dev/null 2>&1
sleep 5
PROCESSES_BEFORE=$(ps aux | grep "phase2Worker" | grep -v grep | wc -l)
echo "   Processes before stop: $PROCESSES_BEFORE"
./scripts/worker-stop.sh > /dev/null 2>&1
sleep 2
PROCESSES_AFTER=$(ps aux | grep "phase2Worker" | grep -v grep | wc -l)
echo "   Processes after stop:  $PROCESSES_AFTER"
if [ "$PROCESSES_AFTER" -eq 0 ]; then
  echo "✅ PASS: All worker processes stopped"
else
  echo "❌ FAIL: $PROCESSES_AFTER orphaned processes"
  ps aux | grep "phase2Worker" | grep -v grep
  exit 1
fi
echo ""

# Test 3: Job Release on Shutdown
echo "🧪 Test 3: Job Release (no orphaned running jobs)"
echo "─────────────────────────────────────────────────────────────────"
./scripts/release-all-leases.sh > /dev/null 2>&1
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c \
  "UPDATE evaluation_jobs SET status='queued';" > /dev/null 2>&1
./scripts/worker-start.sh > /dev/null 2>&1
sleep 8
RUNNING_BEFORE=$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c \
  "SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';")
echo "   Running jobs before stop: $RUNNING_BEFORE"
./scripts/worker-stop.sh > /dev/null 2>&1
sleep 2
RUNNING_AFTER=$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c \
  "SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';")
echo "   Running jobs after stop:  $RUNNING_AFTER"
if [ "$RUNNING_AFTER" -eq 0 ]; then
  echo "✅ PASS: No orphaned running jobs"
else
  echo "❌ FAIL: $RUNNING_AFTER orphaned running jobs"
  exit 1
fi
echo ""

# Test 4: Lease Reset Script
echo "🧪 Test 4: Lease Reset (release-all-leases.sh)"
echo "─────────────────────────────────────────────────────────────────"
docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c \
  "UPDATE evaluation_jobs SET status='running', worker_id='test-stuck-worker', lease_until=NOW() - INTERVAL '10 minutes';" > /dev/null 2>&1
STUCK_BEFORE=$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c \
  "SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';")
echo "   Stuck running jobs:       $STUCK_BEFORE"
./scripts/release-all-leases.sh > /dev/null 2>&1
STUCK_AFTER=$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c \
  "SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';")
echo "   Running jobs after reset: $STUCK_AFTER"
if [ "$STUCK_AFTER" -eq 0 ]; then
  echo "✅ PASS: All stuck jobs released"
else
  echo "❌ FAIL: $STUCK_AFTER jobs still stuck"
  exit 1
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    🎉 ALL TESTS PASSED                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Phase 2A hardening verified:"
echo "  ✅ Environment determinism (.env.staging.local)"
echo "  ✅ Process group management (setsid + kill -- -PID)"
echo "  ✅ Graceful shutdown with job release"
echo "  ✅ Lease reset automation"
echo ""
echo "Ready for Phase 2B (real data) or Phase 2C (OpenAI testing)"
