#!/usr/bin/env node
/**
 * Minimal Worker Lease Test
 * 
 * Tests actual lease acquisition (not API orchestration).
 * Run 3 of these concurrently against the same job to prove exclusivity.
 */

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random()}`;
const JOB_ID = process.env.JOB_ID;

if (!SUPABASE_URL || !SUPABASE_KEY || !JOB_ID) {
  console.error(`${WORKER_ID}: Missing required env vars`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function attemptLeaseAcquisition() {
  const leaseId = randomUUID();
  const ttlSeconds = 30;
  
  console.log(`${WORKER_ID}: Attempting to acquire lease ${leaseId} for job ${JOB_ID}`);

  // Get current job state
  const { data: job, error: getError } = await supabase
    .from('evaluation_jobs')
    .select('id, status, progress, updated_at')
    .eq('id', JOB_ID)
    .single();

  if (getError || !job) {
    console.log(`${WORKER_ID}: ❌ Job not found`);
    return false;
  }

  // Check eligibility
  if (job.status !== 'queued') {
    console.log(`${WORKER_ID}: ❌ Job not queued (status=${job.status})`);
    return false;
  }

  const existingLease = job.progress?.lease_expires_at;
  if (existingLease && new Date(existingLease) > new Date()) {
    console.log(`${WORKER_ID}: ❌ Lease already held (expires ${existingLease})`);
    return false;
  }

  // Attempt atomic lease acquisition with optimistic lock
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const mergedProgress = {
    ...job.progress,
    lease_id: leaseId,
    lease_expires_at: expiresAt,
    phase: 'phase1',
    phase_status: 'running',
  };

  const { data: updated, error: updateError } = await supabase
    .from('evaluation_jobs')
    .update({
      progress: mergedProgress,
      status: 'running',
      updated_at: new Date().toISOString(),
    })
    .eq('id', JOB_ID)
    .eq('status', 'queued')
    .eq('updated_at', job.updated_at)  // Optimistic lock
    .select('id, progress')
    .maybeSingle();

  if (updateError || !updated) {
    console.log(`${WORKER_ID}: ❌ Failed to acquire lease (lost race)`);
    return false;
  }

  console.log(`${WORKER_ID}: ✅ LEASE ACQUIRED - lease_id=${leaseId}`);
  return true;
}

attemptLeaseAcquisition()
  .then(acquired => {
    process.exit(acquired ? 0 : 1);
  })
  .catch(err => {
    console.error(`${WORKER_ID}: ERROR:`, err.message);
    process.exit(2);
  });
