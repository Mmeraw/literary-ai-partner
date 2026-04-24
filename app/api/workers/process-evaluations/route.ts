/**
 * Evaluation Worker API Route
 * 
 * Endpoint to trigger evaluation job processing.
 * 
 * Authentication methods (in order of precedence):
 * 1. Vercel Cron: x-vercel-cron=1 + x-vercel-id (platform validation)
 * 2. Manual trigger: Authorization: Bearer <CRON_SECRET>
 * 3. Dev testing: ?secret=<CRON_SECRET> (NODE_ENV=development only)
 * 4. Dev proof mode (opt-in): Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *    when NODE_ENV=development and WORKER_ALLOW_SERVICE_ROLE_DEV=1
 * 
 * GET /api/workers/process-evaluations
 * GET /api/workers/process-evaluations?dry_run=1  (returns counts without processing)
 * 
 * Security: Multi-layer auth with Vercel platform verification
 * QA/QC: Timing-safe secret comparison, structured logging, trace IDs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { processQueuedJobs } from '@/lib/evaluation/processor';
import { checkServiceRoleAuth } from '@/lib/auth/api';
import crypto from 'crypto';
import os from 'os';
import { getEvaluationRuntimeConfig } from '@/lib/config/evaluationRuntimeConfig';

// Force Node.js runtime (required for crypto module)
export const runtime = 'nodejs';
// Allow up to 300 seconds per invocation.
export const maxDuration = 300;


// ============================================================================
// CONFIGURATION
// ============================================================================

function getWorkerConfig() {
  const runtimeConfig = getEvaluationRuntimeConfig();
  return {
    // Maximum execution time before timeout (clamped to leave headroom under route maxDuration)
    maxExecutionMs: runtimeConfig.worker.maxExecutionMs,
    // Batch size for processing (defense-in-depth clamp; processor clamps again)
    batchSize: runtimeConfig.worker.batchSize,
    // Lease duration for atomically claimed jobs
    leaseMs: runtimeConfig.worker.leaseMs,
    // Circuit-breaker: stop processing while keeping endpoint operational
    disabled: runtimeConfig.worker.disabled,
  } as const;
}

type CircuitBreakerConfig = {
  enabled: boolean;
  consecutiveFailuresThreshold: number;
  staleRunningThreshold: number;
  noSuccessMinutes: number;
};

type CircuitBreakerEvaluation = {
  tripped: boolean;
  reasons: string[];
  metrics: {
    consecutiveFailures: number;
    staleRunningCount: number;
    recentFailuresCount: number;
    hasRecentSuccess: boolean;
  };
};

function parseIntEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getCircuitBreakerConfig(): CircuitBreakerConfig {
  return {
    enabled:
      process.env.EVAL_WORKER_AUTO_KILL === '1' ||
      process.env.EVAL_WORKER_AUTO_KILL === 'true',
    consecutiveFailuresThreshold: parseIntEnv(
      process.env.EVAL_WORKER_CB_CONSECUTIVE_FAILURES,
      5,
      2,
      50,
    ),
    staleRunningThreshold: parseIntEnv(
      process.env.EVAL_WORKER_CB_STALE_RUNNING_THRESHOLD,
      3,
      1,
      100,
    ),
    noSuccessMinutes: parseIntEnv(
      process.env.EVAL_WORKER_CB_NO_SUCCESS_MINUTES,
      20,
      5,
      240,
    ),
  };
}

async function evaluateCircuitBreaker(config: CircuitBreakerConfig): Promise<CircuitBreakerEvaluation> {
  const baseline: CircuitBreakerEvaluation = {
    tripped: false,
    reasons: [],
    metrics: {
      consecutiveFailures: 0,
      staleRunningCount: 0,
      recentFailuresCount: 0,
      hasRecentSuccess: false,
    },
  };

  if (!config.enabled) {
    return baseline;
  }

  const runtimeConfig = getEvaluationRuntimeConfig();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.warn('[Worker] Circuit breaker enabled but Supabase env is unavailable; skipping auto-kill evaluation');
    return baseline;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
  const staleCutoff = new Date(
    Date.now() - runtimeConfig.staleRunningMinutes * 60_000,
  ).toISOString();
  const successWindowCutoff = new Date(
    Date.now() - config.noSuccessMinutes * 60_000,
  ).toISOString();

  const [
    { data: latestJobs, error: latestJobsError },
    { count: staleRunningCount, error: staleCountError },
    { count: recentFailuresCount, error: recentFailuresError },
    { data: recentSuccessRows, error: recentSuccessError },
  ] = await Promise.all([
    supabase
      .from('evaluation_jobs')
      .select('status')
      .order('updated_at', { ascending: false })
      .limit(config.consecutiveFailuresThreshold),
    supabase
      .from('evaluation_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running')
      .not('last_heartbeat_at', 'is', null)
      .lt('last_heartbeat_at', staleCutoff),
    supabase
      .from('evaluation_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', successWindowCutoff),
    supabase
      .from('evaluation_jobs')
      .select('id')
      .eq('status', 'complete')
      .gte('updated_at', successWindowCutoff)
      .limit(1),
  ]);

  if (latestJobsError || staleCountError || recentFailuresError || recentSuccessError) {
    console.warn('[Worker] Circuit breaker query failed; continuing without auto-kill', {
      latestJobsError: latestJobsError?.message,
      staleCountError: staleCountError?.message,
      recentFailuresError: recentFailuresError?.message,
      recentSuccessError: recentSuccessError?.message,
    });
    return baseline;
  }

  const hasFullFailureWindow = (latestJobs?.length ?? 0) === config.consecutiveFailuresThreshold;
  const allLatestFailed = hasFullFailureWindow &&
    (latestJobs ?? []).every((job) => job.status === 'failed');
  const consecutiveFailures = allLatestFailed ? config.consecutiveFailuresThreshold : 0;

  const staleCount = staleRunningCount ?? 0;
  const failureCount = recentFailuresCount ?? 0;
  const hasRecentSuccess = (recentSuccessRows?.length ?? 0) > 0;

  const reasons: string[] = [];
  if (consecutiveFailures >= config.consecutiveFailuresThreshold) {
    reasons.push('consecutive_failures');
  }
  if (staleCount >= config.staleRunningThreshold) {
    reasons.push('stale_running_threshold');
  }
  if (!hasRecentSuccess && failureCount >= config.consecutiveFailuresThreshold) {
    reasons.push('no_recent_success_with_failures');
  }

  return {
    tripped: reasons.length > 0,
    reasons,
    metrics: {
      consecutiveFailures,
      staleRunningCount: staleCount,
      recentFailuresCount: failureCount,
      hasRecentSuccess,
    },
  };
}

// ============================================================================
// AUTH UTILITIES (Production-grade, timing-safe)
// ============================================================================

// Max secret length to prevent CPU burn attacks
const MAX_SECRET_LENGTH = 512;

/**
 * Timing-safe string comparison using SHA-256 digests
 * This eliminates length mismatch timing issues entirely
 * Returns { equal: boolean, secretTooLong: boolean }
 */
function timingSafeEqual(a?: string | null, b?: string | null): { equal: boolean; secretTooLong: boolean } {
  if (!a || !b) return { equal: false, secretTooLong: false };
  
  // Guard against CPU burn attacks with oversized secrets
  if (a.length > MAX_SECRET_LENGTH || b.length > MAX_SECRET_LENGTH) {
    return { equal: false, secretTooLong: true };
  }
  
  const aHash = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bHash = crypto.createHash('sha256').update(b, 'utf8').digest();
  return { equal: crypto.timingSafeEqual(aHash, bHash), secretTooLong: false };
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

/**
 * Check if running on Vercel platform (not spoofable via headers)
 */
function isOnVercelPlatform(): boolean {
  // Auth-critical: read directly from process.env to avoid singleton cache stale-reads.
  // The runtimeConfig singleton is populated at first call; test env mutations must not be
  // blocked by a cached snapshot that pre-dates the test's setEnv() calls.
  return process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
}

/**
 * Validate Vercel Cron invocation
 * Requires: x-vercel-cron header + x-vercel-id header + running on Vercel
 */
function isVercelCronInvocation(req: NextRequest): boolean {
  const cronHeader = req.headers.get('x-vercel-cron') === '1';
  const vercelId = req.headers.get('x-vercel-id');
  return cronHeader && !!vercelId && isOnVercelPlatform();
}

/**
 * Main authorization check
 * Returns: { authorized: boolean, method: string }
 */
function checkAuthorization(req: NextRequest): { authorized: boolean; method: string; secretTooLong: boolean } {
  const runtimeConfig = getEvaluationRuntimeConfig();
  // Auth-critical: read CRON_SECRET directly to avoid singleton cache stale-reads in tests.
  const expectedSecret = process.env.CRON_SECRET || '';
  const bearer = extractBearer(req.headers.get('authorization'));
  const allowDevServiceRole =
    runtimeConfig.platform.nodeEnv === 'development' &&
    runtimeConfig.worker.allowDevServiceRole;
  
  // Method 1: Vercel Cron invocation (highest trust)
  if (isVercelCronInvocation(req)) {
    return { authorized: true, method: 'vercel_cron', secretTooLong: false };
  }
  
  // Method 2: Bearer token (manual/admin trigger)
  if (expectedSecret && bearer) {
    const result = timingSafeEqual(bearer, expectedSecret);
    if (result.secretTooLong) {
      return { authorized: false, method: 'bearer_rejected', secretTooLong: true };
    }
    if (result.equal) {
      return { authorized: true, method: 'bearer', secretTooLong: false };
    }
  }
  
  // Method 3: Query secret (development only)
  if (runtimeConfig.platform.nodeEnv === 'development') {
    const querySecret = req.nextUrl.searchParams.get('secret');
    if (expectedSecret && querySecret) {
      const result = timingSafeEqual(querySecret, expectedSecret);
      if (result.secretTooLong) {
        return { authorized: false, method: 'dev_query_rejected', secretTooLong: true };
      }
      if (result.equal) {
        return { authorized: true, method: 'dev_query', secretTooLong: false };
      }
    }
  }

  // Method 4: Development-only service-role auth (explicit opt-in)
  if (allowDevServiceRole && checkServiceRoleAuth(req)) {
    return { authorized: true, method: 'dev_service_role', secretTooLong: false };
  }
  
  return { authorized: false, method: 'none', secretTooLong: false };
}

/**
 * Generate debug context for logging (never includes actual secrets)
 */
function getAuthDebugContext(req: NextRequest): Record<string, unknown> {
  const runtimeConfig = getEvaluationRuntimeConfig();
  return {
    nodeEnv: runtimeConfig.platform.nodeEnv,
    vercelEnv: runtimeConfig.platform.vercelEnv,
    isVercelPlatform: isOnVercelPlatform(),
    hasExpectedSecret: !!runtimeConfig.auth.cronSecret,
    hasAuthHeader: !!req.headers.get('authorization'),
    hasQuerySecret: !!req.nextUrl.searchParams.get('secret'),
    hasXVercelCron: !!req.headers.get('x-vercel-cron'),
    xVercelCronIs1: req.headers.get('x-vercel-cron') === '1',
    hasXVercelId: !!req.headers.get('x-vercel-id'),
    uaStartsWithVercelCron: req.headers.get('user-agent')?.startsWith('vercel-cron') ?? false,
    allowDevServiceRole: runtimeConfig.worker.allowDevServiceRole,
  };
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Generate a trace ID for request tracking
 */
function generateTraceId(): string {
  return crypto.randomUUID();
}

function buildWorkerId(traceId: string): string {
  const runtimeConfig = getEvaluationRuntimeConfig();
  const env = runtimeConfig.platform.vercelEnv || runtimeConfig.platform.nodeEnv || 'unknown-env';
  const host = runtimeConfig.platform.hostname || os.hostname() || 'unknown-host';
  const tracePart = traceId.slice(0, 12);
  return `${env}:${host}:${tracePart}`;
}

/**
 * Structured log entry
 */
interface LogEntry {
  traceId: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

function structuredLog(entry: LogEntry): void {
  const logLine = JSON.stringify({
    ...entry,
    service: 'process-evaluations-worker',
  });
  
  switch (entry.level) {
    case 'error':
      console.error(logLine);
      break;
    case 'warn':
      console.warn(logLine);
      break;
    default:
      console.log(logLine);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const startTime = Date.now();
  const workerConfig = getWorkerConfig();
  
  // Auth check
  const auth = checkAuthorization(request);
  
  if (!auth.authorized) {
    structuredLog({
      traceId,
      timestamp: new Date().toISOString(),
      level: 'warn',
      message: 'Unauthorized access attempt',
      data: getAuthDebugContext(request),
    });
    
    return NextResponse.json(
      { success: false, error: 'Unauthorized', traceId },
      { status: 401 }
    );
  }
  
  // Check for dry-run mode
  const isDryRun = request.nextUrl.searchParams.get('dry_run') === '1';
  
  structuredLog({
    traceId,
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Worker invoked',
    data: {
      authMethod: auth.method,
      secretTooLong: auth.secretTooLong,
      isDryRun,
      nodeEnv: getEvaluationRuntimeConfig().platform.nodeEnv,
      vercelEnv: getEvaluationRuntimeConfig().platform.vercelEnv,
            // Auth presence flags for audit
      ...getAuthDebugContext(request),
    },
  });
  
  try {
    if (isDryRun) {
      // Dry run: return status without processing
      // TODO: Implement actual queue count check
      const durationMs = Date.now() - startTime;
      
      structuredLog({
        traceId,
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Dry run completed',
        data: { durationMs },
      });
      
      return NextResponse.json({
        success: true,
        dryRun: true,
        traceId,
        authMethod: auth.method,
        message: 'Dry run mode - no jobs processed',
        timestamp: new Date().toISOString(),
        config: {
          maxDurationSeconds: Math.floor(workerConfig.maxExecutionMs / 1000),
          batchSize: workerConfig.batchSize,
          maxExecutionMs: workerConfig.maxExecutionMs,
          disabled: workerConfig.disabled,
        },
      });
    }

    if (workerConfig.disabled) {
      const durationMs = Date.now() - startTime;

      structuredLog({
        traceId,
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Worker invocation skipped: disabled via env guard',
        data: {
          authMethod: auth.method,
          durationMs,
          disabled: true,
        },
      });

      return NextResponse.json({
        success: true,
        traceId,
        authMethod: auth.method,
        disabled: true,
        halted: true,
        reason: 'EVAL_WORKER_DISABLED',
        message: 'Worker processing is disabled via runtime configuration',
        claimed: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        durationMs,
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }

    const circuitBreakerConfig = getCircuitBreakerConfig();
    const circuitBreakerState = await evaluateCircuitBreaker(circuitBreakerConfig);
    if (circuitBreakerState.tripped) {
      const durationMs = Date.now() - startTime;

      structuredLog({
        traceId,
        timestamp: new Date().toISOString(),
        level: 'warn',
        message: 'Worker invocation skipped: auto circuit breaker tripped',
        data: {
          authMethod: auth.method,
          durationMs,
          breakerReasons: circuitBreakerState.reasons,
          breakerMetrics: circuitBreakerState.metrics,
          breakerConfig: circuitBreakerConfig,
        },
      });

      return NextResponse.json({
        success: true,
        traceId,
        authMethod: auth.method,
        disabled: true,
        halted: true,
        reason: 'AUTO_CIRCUIT_BREAKER',
        breakerReasons: circuitBreakerState.reasons,
        breakerMetrics: circuitBreakerState.metrics,
        message: 'Worker processing halted by automatic circuit breaker',
        claimed: 0,
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        durationMs,
        timestamp: new Date().toISOString(),
      }, { status: 200 });
    }
    
    // Process queued jobs
    const workerId = buildWorkerId(traceId);
    const results = await processQueuedJobs({
      workerId,
      batchSize: workerConfig.batchSize,
      leaseMs: workerConfig.leaseMs,
    });
    const durationMs = Date.now() - startTime;
    
    structuredLog({
      traceId,
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Worker completed successfully',
      data: {
        authMethod: auth.method,
        workerId,
        durationMs,
        claimed: results.claimed,
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        batchSize: workerConfig.batchSize,
      },
    });
    
    return NextResponse.json({
      success: true,
      traceId,
      authMethod: auth.method,
      workerId,
      durationMs,
      claimed: results.claimed,
      processed: results.processed,
      succeeded: results.succeeded,
      failed: results.failed,
      batchSize: workerConfig.batchSize,
      errors: results.errors,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    structuredLog({
      traceId,
      timestamp: new Date().toISOString(),
      level: 'error',
      message: 'Worker fatal error',
      data: {
        authMethod: auth.method,
        durationMs,
        error: errorMessage,
      },
    });
    
    return NextResponse.json({
      success: false,
      traceId,
      error: errorMessage,
      durationMs,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// Also support POST for webhook triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
