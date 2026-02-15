/**
 * Health Check Endpoint (Gate 6: Observability)
 *
 * Two-tier response:
 *
 * 1. Public (unauthenticated):
 *    GET /api/health → { ok, timestamp, env, git_sha }
 *    (liveness only, no queue diagnostics)
 *
 * 2. Protected (authenticated via Vercel Cron / Bearer / dev secret):
 *    GET /api/health (with auth header) → { ok, timestamp, env, git_sha, queue: {...} }
 *    (includes queue metrics, health classification, and reasons)
 *
 * Security:
 * - Unauthenticated endpoint reveals no queue/db state
 * - Authenticated endpoint requires same 3-layer auth as worker
 * - Service role used only for internal observability (bypasses RLS)
 * - No secrets leaked in responses
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getQueueHealth } from '@/lib/monitoring/queueHealth';
import type { QueueHealthMetrics, HealthClassification } from '@/lib/monitoring/healthThresholds';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================================
// AUTH UTILITIES (Reused from worker for consistency)
// ============================================================================

const MAX_SECRET_LENGTH = 512;

function timingSafeEqual(a?: string | null, b?: string | null): { equal: boolean; secretTooLong: boolean } {
  if (!a || !b) return { equal: false, secretTooLong: false };

  if (a.length > MAX_SECRET_LENGTH || b.length > MAX_SECRET_LENGTH) {
    return { equal: false, secretTooLong: true };
  }

  const aHash = crypto.createHash('sha256').update(a, 'utf8').digest();
  const bHash = crypto.createHash('sha256').update(b, 'utf8').digest();
  return { equal: crypto.timingSafeEqual(aHash, bHash), secretTooLong: false };
}

function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function isOnVercelPlatform(): boolean {
  return process.env.VERCEL === '1' || !!process.env.VERCEL_ENV;
}

function isVercelCronInvocation(req: NextRequest): boolean {
  const cronHeader = req.headers.get('x-vercel-cron') === '1';
  const vercelId = req.headers.get('x-vercel-id');
  return cronHeader && !!vercelId && isOnVercelPlatform();
}

function checkAuthorization(req: NextRequest): { authorized: boolean; method: string; secretTooLong: boolean } {
  const expectedSecret = process.env.CRON_SECRET || '';

  // Method 1: Vercel Cron invocation
  if (isVercelCronInvocation(req)) {
    return { authorized: true, method: 'vercel_cron', secretTooLong: false };
  }

  // Method 2: Bearer token
  const bearer = extractBearer(req.headers.get('authorization'));
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

  return { authorized: false, method: 'none', secretTooLong: false };
}

// ============================================================================
// HELPERS
// ============================================================================

function getEnvironmentLabel(): 'prod' | 'preview' | 'dev' {
  if (process.env.VERCEL_ENV === 'production') return 'prod';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  return 'dev';
}

interface PublicHealthResponse {
  ok: true;
  timestamp: string;
  env: 'prod' | 'preview' | 'dev';
  git_sha?: string;
}

interface ProtectedHealthResponse extends PublicHealthResponse {
  queue?: {
    metrics: QueueHealthMetrics;
    health: string;
    reasons: string[];
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const timestamp = new Date().toISOString();
  const env = getEnvironmentLabel();
  const git_sha = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7);

  // Construct base response (always included)
  const baseResponse: PublicHealthResponse = {
    ok: true,
    timestamp,
    env,
    ...(git_sha && { git_sha }),
  };

  // Check if request is authenticated
  const auth = checkAuthorization(request);

  if (!auth.authorized) {
    // Unauthenticated: return liveness only
    return NextResponse.json(baseResponse, { status: 200 });
  }

  // Authenticated: try to include queue diagnostics
  try {
    const { metrics, classification } = await getQueueHealth();

    const protectedResponse: ProtectedHealthResponse = {
      ...baseResponse,
      queue: {
        metrics,
        health: classification.health,
        reasons: classification.reasons,
      },
    };

    return NextResponse.json(protectedResponse, { status: 200 });
  } catch (error) {
    // If queue data fetch fails, return authenticated base response
    // (don't leak error details to potential attackers)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Health] Queue fetch failed:', errorMessage);

    const baseWithError: ProtectedHealthResponse = {
      ...baseResponse,
      queue: {
        metrics: {
          queued_count: 0,
          running_count: 0,
          failed_last_hour: 0,
          oldest_queued_seconds: null,
          failure_rate_last_hour: 0,
          stuck_running_count: 0,
          stuck_running_oldest_seconds: null,
        },
        health: 'unknown',
        reasons: [`Queue diagnostics unavailable: ${errorMessage}`],
      },
    };

    return NextResponse.json(baseWithError, { status: 200 });
  }
}

// Support POST for webhook compatibility
export async function POST(request: NextRequest) {
  return GET(request);
}
