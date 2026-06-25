import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } | Promise<{ jobId: string }> },
) {
  const resolved = await Promise.resolve(params);
  console.error('[report-download] download route temporarily disabled pending route restoration', {
    jobId: resolved?.jobId ?? null,
    code: 'DOWNLOAD_ROUTE_RESTORE_REQUIRED',
  });

  return NextResponse.json(
    {
      error: 'Downloads are temporarily unavailable while we restore the report export route.',
      code: 'DOWNLOAD_ROUTE_RESTORE_REQUIRED',
    },
    { status: 503 },
  );
}
