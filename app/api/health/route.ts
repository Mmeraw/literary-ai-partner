import { NextResponse } from 'next/server';

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
  const branch = process.env.VERCEL_GIT_COMMIT_REF || 'local';
  
  return NextResponse.json({
    ok: true,
    commit: commit.substring(0, 7),
    branch,
    timestamp: new Date().toISOString(),
  });
}
