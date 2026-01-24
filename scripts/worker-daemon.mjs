#!/usr/bin/env node
/**
 * Worker Daemon - Always-On Job Processor
 * 
 * Runs continuously, polling for eligible jobs via internal API.
 * Uses proven lease-based concurrency control.
 * 
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/worker-daemon.mjs
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

// Load environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env.local');
config({ path: envPath });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000', 10);
const MAX_PER_TICK = parseInt(process.env.WORKER_MAX_PER_TICK || '3', 10);
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

if (!SERVICE_KEY) {
  console.error('[Worker] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

console.log(`[${WORKER_ID}] Worker daemon started`);
console.log(`[${WORKER_ID}] Base URL: ${BASE_URL}`);
console.log(`[${WORKER_ID}] Poll interval: ${POLL_INTERVAL_MS}ms`);
console.log(`[${WORKER_ID}] Max per tick: ${MAX_PER_TICK}`);

console.log(`[${WORKER_ID}] Worker daemon started`);
console.log(`[${WORKER_ID}] Base URL: ${BASE_URL}`);
console.log(`[${WORKER_ID}] Poll interval: ${POLL_INTERVAL_MS}ms`);

let running = true;
let currentJobId = null;

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n[${WORKER_ID}] Received SIGINT, shutting down gracefully...`);
  running = false;
  if (currentJobId) {
    console.log(`[${WORKER_ID}] Current job ${currentJobId} lease will expire naturally`);
  }
});

process.on('SIGTERM', () => {
  console.log(`\n[${WORKER_ID}] Received SIGTERM, shutting down gracefully...`);
  running = false;
});

/**
 * Get eligible jobs via internal API (pre-filtered)
 */
async function getEligibleJobs() {
  const response = await fetch(`${BASE_URL}/api/internal/jobs`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.status}`);
  }
  
  const data = await response.json();
  return {
    phase1: data.phase1_candidates || [],
    phase2: data.phase2_candidates || [],
    summary: data.summary || {}
  };
}

/**
 * Trigger Phase 1 execution
 */
async function triggerPhase1(jobId) {
  const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/run-phase1`, {
    method: 'POST',
  });
  
  return { status: response.status, ok: response.ok, jobId };
}

/**
 * Trigger Phase 2 execution
 */
async function triggerPhase2(jobId) {
  const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/run-phase2`, {
    method: 'POST',
  });
  
  return { status: response.status, ok: response.ok, jobId };
}

/**
 * Handle trigger response with proper state machine
 */
function handleTriggerResponse(result, phase) {
  const { status, ok, jobId } = result;
  
  if (ok || status === 202) {
    console.log(`[${WORKER_ID}] ✓ ${phase} triggered for ${jobId}`);
    return 'success';
  }
  
  if (status === 409) {
    // Expected: job not eligible (already claimed, wrong state, etc.)
    // Do NOT retry immediately - this is correct behavior
    return 'not_eligible';
  }
  
  if (status === 404) {
    // Job vanished or wrong environment - skip permanently
    console.log(`[${WORKER_ID}] ⚠ ${phase} job ${jobId} not found (404) - skipping`);
    return 'not_found';
  }
  
  if (status >= 500) {
    // Server error - worth retrying later
    console.error(`[${WORKER_ID}] ✗ ${phase} server error ${status} for ${jobId}`);
    return 'server_error';
  }
  
  // Other errors (4xx)
  console.error(`[${WORKER_ID}] ✗ ${phase} failed ${status} for ${jobId}`);
  return 'error';
}

/**
 * Process eligible jobs in priority order
 */
async function processJobs() {
  try {
    const { phase1, phase2, summary } = await getEligibleJobs();
    
    let processed = 0;
    const seen = new Set();
    
    // Priority 1: Complete existing work (Phase 2)
    for (const job of phase2) {
      if (!running || processed >= MAX_PER_TICK) break;
      if (seen.has(job.id)) continue;
      
      seen.add(job.id);
      currentJobId = job.id;
      
      try {
        const result = await triggerPhase2(job.id);
        const outcome = handleTriggerResponse(result, 'Phase2');
        
        if (outcome === 'success') {
          processed++;
        }
      } catch (err) {
        console.error(`[${WORKER_ID}] Phase2 exception for ${job.id}:`, err.message);
      }
      
      currentJobId = null;
    }
    
    // Priority 2: Start new work (Phase 1)
    for (const job of phase1) {
      if (!running || processed >= MAX_PER_TICK) break;
      if (seen.has(job.id)) continue;
      
      seen.add(job.id);
      currentJobId = job.id;
      
      try {
        const result = await triggerPhase1(job.id);
        const outcome = handleTriggerResponse(result, 'Phase1');
        
        if (outcome === 'success') {
          processed++;
        }
      } catch (err) {
        console.error(`[${WORKER_ID}] Phase1 exception for ${job.id}:`, err.message);
      }
      
      currentJobId = null;
    }
    
    // Summary log (only if work was available)
    if (phase1.length > 0 || phase2.length > 0) {
      console.log(`[${WORKER_ID}] Tick complete: ${processed} processed, ${phase1.length} P1 eligible, ${phase2.length} P2 eligible`);
    }
    
  } catch (err) {
    console.error(`[${WORKER_ID}] Poll cycle error:`, err.message);
  }
}

/**
 * Main loop
 */
async function main() {
  console.log(`[${WORKER_ID}] Starting main loop...`);
  
  while (running) {
    await processJobs();
    
    if (running) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
  
  console.log(`[${WORKER_ID}] Worker daemon stopped cleanly`);
  process.exit(0);
}

// Start
main().catch(err => {
  console.error(`[${WORKER_ID}] Fatal error:`, err);
  process.exit(1);
});
