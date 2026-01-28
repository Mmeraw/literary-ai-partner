#!/bin/bash
# Emergency reset: Release all running jobs and reset leases
# Use this when a job gets stuck or you need a clean slate
# Usage: ./scripts/release-all-leases.sh
#
# This script does TWO things:
# 1. Reset jobs stuck in 'running' status (manual reset)
# 2. Auto-reset expired leases (jobs where lease_until < NOW)
#
# Run this:
#   - Before worker starts (clean slate)
#   - When testing (clear stuck jobs)
#   - Via cron (automatic cleanup): 0 * * * * cd /path/to/project && ./scripts/release-all-leases.sh

set -euo pipefail

echo "🔄 Releasing all running jobs and resetting leases..."
echo ""

docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -c "
UPDATE evaluation_jobs
SET status = 'queued',
    worker_id = NULL,
    lease_until = NULL,
    last_error = COALESCE(last_error, '') || ' | lease reset'
WHERE status = 'running';
" 2>&1 | grep -E "UPDATE|ERROR" || true

echo "✅ All job resets complete"
echo ""

# Show count (tr removes whitespace from SQL output)
QUEUED_COUNT="$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM evaluation_jobs WHERE status='queued';" | tr -d '[:space:]')"
RUNNING_COUNT="$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM evaluation_jobs WHERE status='running';" | tr -d '[:space:]')"
STUCK_LEASES="$(docker exec supabase_db_literary-ai-partner psql -U postgres -d postgres -t -c "SELECT COUNT(*) FROM evaluation_jobs WHERE status='running' AND lease_until IS NOT NULL AND lease_until < now();" | tr -d '[:space:]')"

echo "📊 Job status:"
echo "   Queued:       $QUEUED_COUNT"
echo "   Running:      $RUNNING_COUNT (should be 0)"
echo "   Stuck leases: $STUCK_LEASES (should be 0)"
