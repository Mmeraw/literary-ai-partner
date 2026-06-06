import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { enforceApiRateLimit } from '@/lib/security/apiRateLimit';
import { requireUser } from '@/lib/security/apiGuards';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } | Promise<{ jobId: string }> },
) {
  const rateLimitDenied = enforceApiRateLimit(request, {
    bucket: 'report_print',
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitDenied) return rateLimitDenied;

  const resolved = await Promise.resolve(params);
  const jobId = resolved.jobId;

  if (!jobId || !UUID_RE.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job ID' }, { status: 400 });
  }

  const auth = await requireUser();
  if (auth.ok === false) return auth.response;
  const user = auth.user;

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from('evaluation_jobs')
    .select('evaluation_result, status, validity_status, manuscripts!inner(user_id)')
    .eq('id', jobId)
    .eq('manuscripts.user_id', user.id)
    .single();

  if (error || !job || !job.evaluation_result || !canReleaseEvaluationRead(job)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const reportUrl = new URL(`/reports/${jobId}`, request.url);
  reportUrl.searchParams.set('print', '1');

  return NextResponse.redirect(reportUrl, { status: 307 });
}
