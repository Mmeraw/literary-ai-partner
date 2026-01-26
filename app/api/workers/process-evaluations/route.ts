/**
 * Evaluation Worker API Route
 * 
 * Endpoint to trigger evaluation job processing.
 * Can be called:
 * - Manually via curl/browser
 * - Via Vercel Cron Jobs (scheduled)
 * - Via Supabase Database Webhooks
 * 
 * GET /api/workers/process-evaluations
 */

import { NextResponse } from 'next/server';
import { processQueuedJobs } from '@/lib/evaluation/processor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds for serverless function

export async function GET() {
  const startTime = Date.now();
  
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
export async function POST() {
  return GET();
}
