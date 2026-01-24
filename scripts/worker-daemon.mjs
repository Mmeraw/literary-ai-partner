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
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

if (!SERVICE_KEY) {
  console.error('[Worker] SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

console.log(`[${WORKER_ID}] Worker daemon started`);
console.log(`[${WORKER_ID}] Base URL: ${BASE_URL}`);
console.log(`[${WORKER_ID}] Poll interval: ${POLL_INTERVAL_MS}ms`);

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
 * Get all jobs via internal API
 */
async function getAllJobs() {
  const response = await fetch(`${BASE_URL}/api/internal/jobs`, {
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${response.status}`);
  }
  
  const data = await response.json();
  return data.jobs || [];
}

/**
 * Trigger Phase 1 execution
 */
async function triggerPhase1(jobId) {
  const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/run-phase1`, {
    method: 'POST',
  });
  
  if (!response.ok && response.status !== 409) {
    throw new Error(`Phase 1 trigger failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Trigger Phase 2 execution
 */
async function triggerPhase2(jobId) {
  const response = await fetch(`${BASE_URL}/api/jobs/${jobId}/run-phase2`, {
    method: 'POST',
  });
  
  if (!response.ok && response.status !== 409) {
    throw new Error(`Phase 2 trigger failed: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Process eligible jobs in priority order
 */
async function processJobs() {
  try {
    const jobs = await getAllJobs();
    
    // Priority 1: Jobs ready for Phase 2
    const phase2Ready = jobs.filter(j => 
      j.status === 'running' &&
      j.progress?.phase === 'phase1' &&
      j.progress?.phase_status === 'complete'
    );
    
    // Priority 2: Queued jobs (Phase 1)
    const queued = jobs.filter(j => j.status === 'queued');
    
    // Process Phase 2 first (complete existing work)
    for (const job of phase2Ready) {
      if (!running) break;
      
      console.log(`[${WORKER_ID}] Triggering Phase 2 for job ${job.id}`);
      currentJobId = job.id;
      
      try {
        await triggerPhase2(job.id);
        console.log(`[${WORKER_ID}] Phase 2 triggered for job ${job.id}`);
      } catch (err) {
        console.error(`[${WORKER_ID}] Phase 2 error for job ${job.id}:`, err.message);
      }
      
      currentJobId = null;
    }
    
    // Then process queued jobs (Phase 1)
    for (const job of queued) {
      if (!running) break;
      
      console.log(`[${WORKER_ID}] Triggering Phase 1 for job ${job.id}`);
      currentJobId = job.id;
      
      try {
        await triggerPhase1(job.id);
        console.log(`[${WORKER_ID}] Phase 1 triggered for job ${job.id}`);
      } catch (err) {
        console.error(`[${WORKER_ID}] Phase 1 error for job ${job.id}:`, err.message);
      }
      
      currentJobId = null;
    }
    
    // Summary
    if (phase2Ready.length === 0 && queued.length === 0) {
      // Silent when idle (reduce noise)
    } else {
      console.log(`[${WORKER_ID}] Processed ${queued.length} Phase 1, ${phase2Ready.length} Phase 2`);
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
