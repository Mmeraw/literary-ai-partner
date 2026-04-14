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
import { processQueuedJobs } from '@/lib/evaluation/processor';
import { checkServiceRoleAuth } from '@/lib/auth/api';
import crypto from 'crypto';
import os from 'os';

// Force Node.js runtime (required for crypto module)
export const runtime = 'nodejs';
// Allow up to 300 seconds per invocation.
export const maxDuration = 300;


// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Maximum execution time before timeout (clamped to leave headroom under route maxDuration)
  MAX_EXECUTION_MS: parseBoundedInt(process.env.EVAL_WORKER_MAX_EXECUTION_MS, {
    fallback: 55000,
    min: 10000,
    max: 295000,
  }),
  // Batch size for processing (defense-in-depth clamp; processor clamps again)
  BATCH_SIZE: parseBoundedInt(process.env.EVAL_WORKER_BATCH_SIZE, {
    fallback: 5,
    min: 1,
    max: 5,
  }),
  // Lease duration for atomically claimed jobs
  LEASE_MS: parseBoundedInt(process.env.EVAL_WORKER_LEASE_MS, {
    fallback: 180000,
    min: 30000,
    max: 180000,
  }),
} as const;

function parseBoundedInt(
  raw: string | undefined,
  options: { fallback: number; min: number; max: number },
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) {
    return options.fallback;
  }
  return Math.min(options.max, Math.max(options.min, parsed));
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
  const expectedSecret = process.env.CRON_SECRET || '';
  const bearer = extractBearer(req.headers.get('authorization'));
  const allowDevServiceRole =
    process.env.NODE_ENV === 'development' &&
    process.env.WORKER_ALLOW_SERVICE_ROLE_DEV === '1';
  
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
  if (process.env.NODE_ENV === 'development') {
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
  return {
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    isVercelPlatform: isOnVercelPlatform(),
    hasExpectedSecret: !!process.env.CRON_SECRET,
    hasAuthHeader: !!req.headers.get('authorization'),
    hasQuerySecret: !!req.nextUrl.searchParams.get('secret'),
    hasXVercelCron: !!req.headers.get('x-vercel-cron'),
    xVercelCronIs1: req.headers.get('x-vercel-cron') === '1',
    hasXVercelId: !!req.headers.get('x-vercel-id'),
    uaStartsWithVercelCron: req.headers.get('user-agent')?.startsWith('vercel-cron') ?? false,
    allowDevServiceRole: process.env.WORKER_ALLOW_SERVICE_ROLE_DEV === '1',
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
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown-env';
  const host = process.env.HOSTNAME || os.hostname() || 'unknown-host';
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
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
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
        message: 'Dry run mode - no jobs processed',
        timestamp: new Date().toISOString(),
        config: {
          maxDurationSeconds: Math.floor(CONFIG.MAX_EXECUTION_MS / 1000),
          batchSize: CONFIG.BATCH_SIZE,
          maxExecutionMs: CONFIG.MAX_EXECUTION_MS,
        },
      });
    }
    
    // Process queued jobs
    const workerId = buildWorkerId(traceId);
    const results = await processQueuedJobs({
      workerId,
      batchSize: CONFIG.BATCH_SIZE,
      leaseMs: CONFIG.LEASE_MS,
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
        batchSize: CONFIG.BATCH_SIZE,
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
      batchSize: CONFIG.BATCH_SIZE,
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
