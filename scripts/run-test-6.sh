#!/bin/bash
# Test 6: Concurrent Lease Contention
# Creates job via SQL, runs 3 workers, captures evidence

set -e

cd /workspaces/literary-ai-partner
source .env.local

echo "==================================="
echo "TEST 6: CONCURRENT LEASE CONTENTION"
echo "==================================="
echo ""

# Create job directly via SQL (no API server needed)
echo "Creating test job via SQL..."

JOB_ID=$(node -e "
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createJob() {
  const jobId = randomUUID();
  const manuscriptId = 2; // Use existing test manuscript
  
  const { data, error } = await supabase
    .from('evaluation_jobs')
    .insert({
      id: jobId,
      manuscript_id: manuscriptId,
      job_type: 'quick_evaluation',
      status: 'queued',
      phase: 'phase_0',
      policy_family: 'standard',
      voice_preservation_level: 'balanced',
      english_variant: 'us',
      progress: {
        phase: 'queued',
        phase_status: 'pending'
      }
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
  
  console.log(data.id);
}

createJob();
")

echo "Created JOB_ID=$JOB_ID"
echo ""

# Export for workers
export JOB_ID
export NEXT_PUBLIC_SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY

echo "Launching 3 concurrent workers..."
echo ""

# Launch workers simultaneously
WORKER_ID=worker-1 node scripts/test-worker-lease.mjs > /tmp/worker-1.log 2>&1 &
PID1=$!
WORKER_ID=worker-2 node scripts/test-worker-lease.mjs > /tmp/worker-2.log 2>&1 &
PID2=$!
WORKER_ID=worker-3 node scripts/test-worker-lease.mjs > /tmp/worker-3.log 2>&1 &
PID3=$!

# Wait for all
wait $PID1 $PID2 $PID3

echo "All workers completed"
echo ""
echo "==================================="
echo "RESULTS:"
echo "==================================="
echo ""

echo "--- Worker 1 ---"
cat /tmp/worker-1.log
echo ""

echo "--- Worker 2 ---"
cat /tmp/worker-2.log
echo ""

echo "--- Worker 3 ---"
cat /tmp/worker-3.log
echo ""

echo "==================================="
echo "DATABASE VERIFICATION:"
echo "==================================="
echo ""

# Query final job state
node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyJob() {
  const { data, error } = await supabase
    .from('evaluation_jobs')
    .select('id, status, progress')
    .eq('id', process.env.JOB_ID)
    .single();
  
  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
  
  console.log('Job ID:', data.id);
  console.log('Status:', data.status);
  console.log('Lease ID:', data.progress?.lease_id || 'none');
  console.log('Lease Expires:', data.progress?.lease_expires_at || 'none');
  console.log('Phase:', data.progress?.phase || 'unknown');
  console.log('Phase Status:', data.progress?.phase_status || 'unknown');
}

verifyJob();
"

echo ""
echo "==================================="
echo "TEST 6 COMPLETE"
echo "==================================="
