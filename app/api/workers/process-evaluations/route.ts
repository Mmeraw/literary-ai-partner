/**
 * Evaluation Worker API Route
 * 
 * Endpoint to trigger evaluation job processing.
 * Authentication methods (in order of precedence):
 * 1. Vercel Cron: x-vercel-cron=1 + x-vercel-id (platform validation)
 * 2. Manual trigger: Authorization: Bearer <CRON_SECRET>
 * 3. Dev testing: ?secret=<CRON_SECRET> (NODE_ENV=development only)
 * 
 * GET /api/workers/process-evaluations
 * 
 * Security: Multi-layer auth with Vercel platform verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { processQueuedJobs } from '@/lib/evaluation/processor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for serverless function

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  // Security check: Verify authorized caller
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret) {
    // Method 1: Authorization Bearer token (manual triggers + Vercel Cron with CRON_SECRET env)
    const authHeader = request.headers.get('authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    // Method 2: Vercel Cron platform headers (primary for scheduled crons)
    const vercelCron = request.headers.get('x-vercel-cron') === '1';
    const vercelId = request.headers.get('x-vercel-id'); // Platform request proof
    const isVercelCronInvocation = vercelCron && !!vercelId;
    
    // Method 3: Query param secret (development/testing only)
    const querySecret = request.nextUrl.searchParams.get('secret');
    const allowQuerySecret = process.env.NODE_ENV === 'development';
    
    const isAuthorized = 
      (bearer && bearer === expectedSecret) ||           // Bearer token match
      isVercelCronInvocation ||                          // Vercel platform cron
      (allowQuerySecret && querySecret === expectedSecret); // Dev-only query param
    
    if (!isAuthorized) {
      console.warn('[Worker] Unauthorized access attempt', {
        hasAuthHeader: !!authHeader,
        hasBearerToken: !!bearer,
        hasQuerySecret: !!querySecret,
        vercelCronHeader: vercelCron,
        vercelIdPresent: !!vercelId,
        environment: process.env.NODE_ENV
      });
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 });
    }
  }
  
  console.log('[Worker] Starting evaluation job processor');

  try {
    const results = await processQueuedJobs();
    
    const duration = Date.now() - startTime;
    
    console.log(`[Worker] Finished in ${duration}ms`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration_ms: duration,
      results: {
        processed: results.processed,
        succeeded: results.succeeded,
        failed: results.failed,
        errors: results.errors
      }
    }, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Worker] Fatal error:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Also support POST for webhook triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
