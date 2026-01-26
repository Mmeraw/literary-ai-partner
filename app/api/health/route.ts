/**
 * Health Check Endpoint
 * 
 * Returns deployment status and configuration health.
 * Use this to diagnose 404s, env issues, and deployment state.
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || 'local-dev';
  const shortCommit = commit.substring(0, 7);
  const branch = process.env.VERCEL_GIT_COMMIT_REF || 'local';
  
  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    commit: shortCommit,
    branch,
    config: {
      has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_supabase_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_cron_secret: !!process.env.CRON_SECRET,
      has_openai_key: !!process.env.OPENAI_API_KEY,
    }
  });
}
