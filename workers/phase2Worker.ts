#!/usr/bin/env tsx
/**
 * Phase 2 Worker Daemon
 *
 * Responsibilities:
 * - Poll for eligible Phase 2 jobs
 * - Claim jobs atomically
 * - Process evaluation requests
 * - Maintain heartbeat during work
 * - Handle graceful shutdown
 * - Release jobs on crash/shutdown
 *
 * Governance:
 * - Exactly-once job execution
 * - Deterministic lifecycle (start/stop)
 * - Phase 2C Evidence Gate proof: CI trigger test
 * - Observable state (logs, heartbeat)
 * - No silent failures
 */

// Load environment variables FIRST (before any other imports)
// Phase 2C Evidence Gate: CI-compatible script paths proof
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({
  path: process.env.DOTENV_CONFIG_PATH || '.env.staging.local',
  override: true, // Override any pre-loaded env vars (e.g., from tsx preflight)
});

import { resolve } from 'path';

import {
  claimNextJob,
  releaseJob,
  updateHeartbeat,
  completeJob,
  failJob,
  type ClaimResult
} from './claimJob';
import {
  executePhase2Evaluation,
  isRetryableError,
  type EvaluationContext
} from './phase2Evaluation';
import {
  type ProviderCallRecord,
  truncateErrorMessage,
  toCanonicalEnvelope
} from '../types/providerCalls';
import { createClient } from '@supabase/supabase-js';
import { createWriteStream, WriteStream } from 'fs';

// Allow WORKER_ID override for multi-worker concurrency testing
const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}-${Date.now()}`;
const POLL_INTERVAL_MS = 5000; // 5 seconds
const HEARTBEAT_INTERVAL_MS = 60000; // 1 minute

// Optional: write logs to file (for concurrency testing)
let logStream: WriteStream | null = null;
if (process.env.WORKER_LOG) {
  logStream = createWriteStream(process.env.WORKER_LOG, { flags: 'a' });
}

let isShuttingDown = false;
let currentJobId: string | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;

/**
 * Main worker loop
 */
async function workerLoop() {
  log('info', 'Worker started', { workerId: WORKER_ID });

  while (!isShuttingDown) {
    try {
      // Attempt to claim next job
      const job = await claimNextJob(WORKER_ID);

      // Canon Fix #4: Never log "Job claimed" unless you have a real job object
      if (!job?.id) {
        // Normal idle state: no claim available (don't log "claimed" on idle)
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Job claimed successfully - only reached when job.id exists
      currentJobId = job.id;
      log('info', 'Job claimed', { 
        workerId: WORKER_ID,
        jobId: job.id,
        manuscriptId: job.manuscript_id,
        job_type: job.job_type,
        policy_family: job.policy_family,
        voice_preservation_level: job.voice_preservation_level,
        english_variant: job.english_variant
      });

      // Start heartbeat
      startHeartbeat(job.id);

      // Process job (pass full job object from claim)
      await processJob(job);

      // Stop heartbeat
      stopHeartbeat();
      currentJobId = null;
    } catch (err) {
      log('error', 'Worker loop error', { error: String(err) });
      await sleep(POLL_INTERVAL_MS);
    }
  }

  log('info', 'Worker loop exited');
}

/**
 * Fetch manuscript content chunks from database
 * Retrieves all chunks for the given manuscript, ordered by chunk_index
 */
async function fetchManuscriptContent(manuscriptId: number): Promise<{ 
  chunks: Array<{ id: string; chunk_index: number; content: string }>;
  totalChars: number;
} | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('manuscript_chunks')
      .select('id, chunk_index, content')
      .eq('manuscript_id', manuscriptId)
      .order('chunk_index', { ascending: true });

    if (error) {
      log('error', 'Failed to fetch manuscript chunks', { manuscriptId, error: error.message });
      return null;
    }

    if (!data || data.length === 0) {
      log('warn', 'No chunks found for manuscript', { manuscriptId });
      return { chunks: [], totalChars: 0 };
    }

    const totalChars = data.reduce((sum, chunk) => sum + chunk.content.length, 0);

    return { chunks: data, totalChars };
  } catch (err) {
    log('error', 'Error fetching manuscript content', { manuscriptId, error: String(err) });
    return null;
  }
}

/**
 * QUARANTINED: fetchJobDetails() is no longer needed.
 * Canon: claimNextJob() already returns the full job row via claim_job_atomic RPC.
 * Keeping this for reference only - DO NOT USE.
 */
/*
async function fetchJobDetails(jobId: string): Promise<EvaluationContext | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('evaluation_jobs')
      .select('manuscript_id, job_type, phase, policy_family, voice_preservation_level, english_variant, work_type')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      log('error', 'Failed to fetch job details', { jobId, error: error?.message });
      return null;
    }

    return {
      jobId,
      manuscriptId: data.manuscript_id,
      workType: data.work_type || data.job_type,
      phase: data.phase || 'phase_2',
      policyFamily: data.policy_family,
      voicePreservationLevel: data.voice_preservation_level,
      englishVariant: data.english_variant
    };
  } catch (err) {
    log('error', 'Error fetching job details', { jobId, error: String(err) });
    return null;
  }
}
*/

/**
 * Process a claimed job
 */
async function processJob(job: ClaimResult): Promise<void> {
  const jobId = job.id;
  
  try {
    log('info', 'Processing job', { jobId });

    // Canon: claim RPC already returns the full job row. No enrichment fetch needed.
    const context: EvaluationContext = {
      jobId: job.id,
      manuscriptId: job.manuscript_id,
      workType: job.job_type,
      phase: 'phase_2',
      policyFamily: job.policy_family,
      voicePreservationLevel: job.voice_preservation_level,
      englishVariant: job.english_variant
    };

    // Fetch manuscript chunks
    log('info', 'Fetching manuscript content', { 
      jobId, 
      manuscriptId: context.manuscriptId 
    });
    
    const manuscriptData = await fetchManuscriptContent(context.manuscriptId);
    if (!manuscriptData) {
      await failJob(jobId, 'Failed to fetch manuscript content');
      return;
    }

    const { chunks, totalChars } = manuscriptData;
    
    // Log chunk metrics
    log('info', 'Manuscript content loaded', {
      jobId,
      manuscriptId: context.manuscriptId,
      chunkCount: chunks.length,
      totalChars,
      avgCharsPerChunk: chunks.length > 0 ? Math.round(totalChars / chunks.length) : 0
    });

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      log('warn', 'OpenAI API key not configured, using simulated evaluation', { jobId });
      
      // Fallback: simulated work
      await sleep(2000);
      const success = await completeJob(jobId, { 
        simulated: true,
        message: 'OpenAI integration not configured',
        chunks_processed: chunks.length,
        total_chars: totalChars
      });
      
      if (success) {
        log('info', 'Job completed (simulated)', { jobId, chunks_processed: chunks.length });
      } else {
        log('error', 'Failed to mark job complete', { jobId });
      }
      return;
    }

    // Execute actual Phase 2 evaluation
    const result = await executePhase2Evaluation(context, log);

    // Persist provider call for audit trail (Phase 2C-4)
    // Call this after evaluation completes, whether success or failure
    // The persistProviderCall function is non-fatal; it logs errors but doesn't throw
    await persistProviderCall({
      job_id: jobId,
      phase: 'phase_2',
      provider: process.env.OPENAI_API_KEY ? 'openai' : 'simulated',
      provider_meta_version: '2c1.v1',
      request_meta: {
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: Number(process.env.OPENAI_TEMPERATURE ?? '0.2'),
        max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? '1200'),
        prompt_version: 'phase2-v1',
        input_chars: totalChars,
      },
      response_meta: result.metadata.provider_meta
        ? {
            latency_ms: result.metadata.provider_meta.latency_ms ?? 0,
            retries: result.metadata.provider_meta.retries ?? 0,
            status_code: result.metadata.provider_meta.error?.status,
            output_chars: JSON.stringify(result).length,
            finish_reason: result.metadata.provider_meta.request_id ? 'stop' : undefined,
          }
        : undefined,
      error_meta: result.metadata.provider_meta?.error
        ? {
            code: result.metadata.provider_meta.error.code,
            status_code: result.metadata.provider_meta.error.status,
            retryable: result.metadata.provider_meta.error.kind === 'retryable_exhausted' || result.partial,
            message: truncateErrorMessage(result.metadata.provider_meta.error.message ?? '', 512),
            error_kind: result.metadata.provider_meta.error.kind,
          }
        : undefined,
      result_envelope: toCanonicalEnvelope(result),
    });

    // Enhance result with chunk metrics
    const enrichedResult = {
      ...result,
      metadata: {
        ...result.metadata,
        chunks_processed: chunks.length,
        total_chars: totalChars
      }
    };

    // Mark complete with result
    const success = await completeJob(jobId, enrichedResult);
    
    if (success) {
      log('info', 'Job completed', { 
        jobId,
        verdict: result.overview.verdict,
        tokensUsed: result.metadata.tokensUsed,
        chunks_processed: chunks.length
      });
    } else {
      log('error', 'Failed to mark job complete', { jobId });
    }
  } catch (err: any) {
    const errorMsg = String(err);
    log('error', 'Job processing failed', { jobId, error: errorMsg });
    
    // Phase A.1: Create structured error envelope
    const { toErrorEnvelope } = await import('../lib/errors/errorEnvelope');
    const { setJobFailed } = await import('../lib/jobs/store');
    
    const envelope = toErrorEnvelope(err, {
      phase: 'phase_2',
      jobId,
      manuscriptId: job.manuscript_id,
      provider: process.env.OPENAI_API_KEY ? 'openai' : undefined,
    });
    
    log('info', 'Error classification', { 
      jobId, 
      code: envelope.code,
      retryable: envelope.retryable 
    });
    
    // Persist structured error to evaluation_jobs.last_error
    await setJobFailed(jobId, envelope);
    
    // Legacy: Also persist to provider call audit trail
    const { isRetryableError } = await import('./phase2Evaluation');
    const retryable = isRetryableError(err);
    
    await persistProviderCall({
      job_id: jobId,
      phase: 'phase_2',
      provider: 'openai',
      provider_meta_version: '2c1.v1',
      request_meta: {
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: Number(process.env.OPENAI_TEMPERATURE ?? '0.2'),
        max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? '1200'),
        prompt_version: 'phase2-v1',
        input_chars: 0, // Unknown at error time
      },
      error_meta: {
        code: envelope.code,
        retryable: envelope.retryable,
        message: truncateErrorMessage(errorMsg, 512),
        error_kind: 'unknown',
      },
      result_envelope: toCanonicalEnvelope({ metadata: { simulated: false } }, { simulatedDefault: false }),
    });
  }
}

/**
 * Start heartbeat timer for active job
 */
function startHeartbeat(jobId: string) {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(async () => {
    const success = await updateHeartbeat(jobId, WORKER_ID);
    if (success) {
      log('debug', 'Heartbeat updated', { jobId });
    } else {
      log('warn', 'Heartbeat update failed', { jobId });
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat timer
 */
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  if (isShuttingDown) {
    log('warn', 'Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  log('info', `Received ${signal}, shutting down gracefully...`);

  // Stop heartbeat
  stopHeartbeat();

  // Release current job if any
  if (currentJobId) {
    log('info', 'Releasing current job', { jobId: currentJobId });
    await releaseJob(currentJobId);
    currentJobId = null;
  }

  log('info', 'Worker shutdown complete');
  process.exit(0);
}

/**
 * Structured logging
 */
function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    workerId: WORKER_ID,
    message,
    ...meta
  };

  const jsonLine = JSON.stringify(entry) + '\n';

  // Write to file if WORKER_LOG is set (for concurrency testing)
  if (logStream) {
    logStream.write(jsonLine);
  }

  // Also write to console
  if (level === 'error') {
    console.error(jsonLine.trim());
  } else if (level === 'debug') {
    // Skip debug in production
    if (process.env.NODE_ENV !== 'production') {
      console.log(jsonLine.trim());
    }
  } else {
    console.log(jsonLine.trim());
  }
}

/**
 * Persist provider call record to evaluation_provider_calls table
 * (Phase 2C-4: Audit-grade forensics)
 * 
 * Called after executePhase2Evaluation completes (success or failure).
 * Provides append-only audit trail for all provider interactions.
 */
async function persistProviderCall(rec: ProviderCallRecord): Promise<void> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
    );

    // Phase 2D idempotency: ON CONFLICT DO UPDATE ensures exactly-once semantics
    // If job retries/reclaims, update existing record instead of failing
    const { error } = await supabase
      .from('evaluation_provider_calls')
      .insert({
        job_id: rec.job_id,
        phase: rec.phase,
        provider: rec.provider,
        provider_meta_version: rec.provider_meta_version,
        request_meta: rec.request_meta,
        response_meta: rec.response_meta ?? null,
        error_meta: rec.error_meta ?? null,
        result_envelope: rec.result_envelope ?? null,
      })
      .select()
      .single()
      // @ts-ignore - upsert not in types but supported by Supabase
      .then((res: any) => {
        // If unique constraint violated, update instead
        if (res.error?.code === '23505') {
          return supabase
            .from('evaluation_provider_calls')
            .update({
              provider_meta_version: rec.provider_meta_version,
              request_meta: rec.request_meta,
              response_meta: rec.response_meta ?? null,
              error_meta: rec.error_meta ?? null,
              result_envelope: rec.result_envelope ?? null,
            })
            .eq('job_id', rec.job_id)
            .eq('provider', rec.provider)
            .eq('phase', rec.phase);
        }
        return res;
      });

    if (error) {
      log('error', 'Failed to persist provider call', {
        jobId: rec.job_id,
        provider: rec.provider,
        errorMessage: error.message,
      });
      // Non-fatal: don't throw; log only
      return;
    }

    log('debug', 'Provider call persisted', {
      jobId: rec.job_id,
      provider: rec.provider,
      hasResponse: !!rec.response_meta,
      hasError: !!rec.error_meta,
    });
  } catch (err: any) {
    log('error', 'Exception in persistProviderCall', {
      jobId: rec.job_id,
      error: String(err),
    });
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Entry point
 */
async function main() {
  // Validate environment
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('NEXT_PUBLIC_SUPABASE_URL not set');
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not set');
    process.exit(1);
  }

  // Register shutdown handlers
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Unhandled errors
  process.on('unhandledRejection', (err) => {
    log('error', 'Unhandled rejection', { error: String(err) });
    shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    log('error', 'Uncaught exception', { error: String(err) });
    shutdown('uncaughtException');
  });

  // Start worker loop
  await workerLoop();
}

// Run
main();
