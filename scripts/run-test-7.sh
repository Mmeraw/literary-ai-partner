#!/bin/bash
# Test 7: Lease Expiry Recovery
# Forces stale lease, verifies new worker can reclaim

set -e

cd /workspaces/literary-ai-partner
source .env.local

echo "==================================="
echo "TEST 7: LEASE EXPIRY RECOVERY"
echo "==================================="
echo ""

# Preflight: Check required environment variables
echo "[Preflight] Checking required environment variables..."
MISSING_VARS=()

if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
  MISSING_VARS+=("NEXT_PUBLIC_SUPABASE_URL")
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  MISSING_VARS+=("SUPABASE_SERVICE_ROLE_KEY")
fi

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
  echo "❌ Missing required environment variables:"
  for var in "${MISSING_VARS[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Required variables:"
  echo "  NEXT_PUBLIC_SUPABASE_URL     - Supabase project URL"
  echo "  SUPABASE_SERVICE_ROLE_KEY    - Service role key for admin operations"
  echo ""
  echo "Load them with: source .env.local"
  exit 1
fi

echo "✅ All required environment variables present"
echo ""

# Step 1: Create job and acquire initial lease
echo "[Step 1] Creating test job and acquiring initial lease..."

JOB_ID=$(node -e "
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAndClaimJob() {
  const jobId = randomUUID();
  
  // Create job with ALL required fields (matches check constraints)
  await supabase.from('evaluation_jobs').insert({
    id: jobId,
    manuscript_id: 2,
    job_type: 'quick_evaluation',       // Matches evaluation_jobs_job_type_check
    status: 'queued',
    phase: 'phase_0',                   // Matches evaluation_jobs_phase_check
    policy_family: 'standard',          // Matches chk_eval_jobs_policy_family
    voice_preservation_level: 'balanced', // Matches chk_eval_jobs_voice_preservation_level
    english_variant: 'us',              // Matches chk_eval_jobs_english_variant
    progress: { phase: 'queued', phase_status: 'pending' }
  });
  
  console.log(jobId);
}

createAndClaimJob();
")

echo "Created JOB_ID=$JOB_ID"
export JOB_ID
export NEXT_PUBLIC_SUPABASE_URL
export SUPABASE_SERVICE_ROLE_KEY

# Acquire initial lease
echo ""
echo "Acquiring initial lease with worker-initial..."
WORKER_ID=worker-initial node scripts/test-worker-lease.mjs > /tmp/worker-initial.log 2>&1
INITIAL_EXIT=$?

echo ""
cat /tmp/worker-initial.log
echo ""

if [ $INITIAL_EXIT -ne 0 ]; then
  echo "❌ Initial lease acquisition failed (unexpected)"
  exit 1
fi

echo "✅ Initial lease acquired"
echo ""

# Step 2: Force stale lease via SQL
echo "[Step 2] Forcing lease expiry (set to 30 minutes ago)..."

node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function forceExpiry() {
  // Calculate timestamp 30 minutes ago
  const expiredTime = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: before } = await supabase
    .from('evaluation_jobs')
    .select('progress')
    .eq('id', process.env.JOB_ID)
    .single();
  
  console.log('Before: lease_expires_at =', before.progress.lease_expires_at);
  
  // Force expired lease
  const { error } = await supabase
    .from('evaluation_jobs')
    .update({
      status: 'queued',  // Reset to queued so worker can reclaim
      progress: {
        ...before.progress,
        lease_expires_at: expiredTime,
        phase_status: 'stale'  // Mark as stale for audit
      }
    })
    .eq('id', process.env.JOB_ID);
  
  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
  
  const { data: after } = await supabase
    .from('evaluation_jobs')
    .select('progress')
    .eq('id', process.env.JOB_ID)
    .single();
  
  console.log('After:  lease_expires_at =', after.progress.lease_expires_at);
  console.log('✅ Lease forced to expired state');
}

forceExpiry();
"

echo ""

# Step 3: Attempt reclaim with new worker
echo "[Step 3] Attempting lease reclaim with worker-reclaim..."
echo ""

WORKER_ID=worker-reclaim node scripts/test-worker-lease.mjs > /tmp/worker-reclaim.log 2>&1
RECLAIM_EXIT=$?

cat /tmp/worker-reclaim.log
echo ""

if [ $RECLAIM_EXIT -ne 0 ]; then
  echo "❌ Lease reclaim failed (unexpected)"
  exit 1
fi

echo "✅ Lease reclaim successful"
echo ""

# Step 4: Verify final state
echo "[Step 4] Database verification..."
echo ""

node -e "
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyReclaim() {
  const { data } = await supabase
    .from('evaluation_jobs')
    .select('id, status, progress')
    .eq('id', process.env.JOB_ID)
    .single();
  
  console.log('Job ID:', data.id);
  console.log('Status:', data.status);
  console.log('Lease ID:', data.progress?.lease_id || 'none');
  console.log('Lease Expires:', data.progress?.lease_expires_at || 'none');
  console.log('Phase:', data.progress?.phase || 'unknown');
  
  // Parse and check if new lease is in future
  const expiresAt = new Date(data.progress.lease_expires_at);
  const now = new Date();
  const secondsUntilExpiry = (expiresAt - now) / 1000;
  
  console.log('');
  console.log('Lease validity check:');
  console.log('  Expires at:', expiresAt.toISOString());
  console.log('  Current time:', now.toISOString());
  console.log('  Seconds until expiry:', Math.floor(secondsUntilExpiry));
  
  if (secondsUntilExpiry > 0) {
    console.log('  ✅ Lease is ACTIVE (expires in future)');
  } else {
    console.log('  ❌ Lease is EXPIRED (should not happen)');
  }
}

verifyReclaim();
"

echo ""
echo "==================================="
echo "TEST 7 COMPLETE"
echo "==================================="
