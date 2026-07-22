import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  evaluateAuthorExposureCertificationWithFinalExternalAudit,
} from '@/lib/evaluation/authorExposureCertification';
import {
  aggregateEvaluationReliability,
  type ExposureState,
  type ReliabilityJob,
} from '@/lib/observability/evaluationReliabilitySlo';
import { TEST_MANUSCRIPT_ID_MIN } from '@/lib/manuscripts/testRange';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;
const QUERY_LIMIT = 5_000;

type ArtifactRow = {
  job_id: string;
  artifact_type: string;
  content: unknown;
  created_at: string;
};

function boundedDays(value: string | null): number {
  const parsed = Number(value ?? DEFAULT_DAYS);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_DAYS) return DEFAULT_DAYS;
  return parsed;
}

function exposureByJob(artifacts: ArtifactRow[]): Map<string, ExposureState> {
  const latest = new Map<string, Map<string, unknown>>();
  for (const artifact of artifacts) {
    const byType = latest.get(artifact.job_id) ?? new Map<string, unknown>();
    if (!byType.has(artifact.artifact_type)) byType.set(artifact.artifact_type, artifact.content);
    latest.set(artifact.job_id, byType);
  }

  const result = new Map<string, ExposureState>();
  for (const [jobId, byType] of latest) {
    const certification = byType.get('author_exposure_certification_v1');
    if (certification == null) {
      result.set(jobId, 'unknown');
      continue;
    }
    const decision = evaluateAuthorExposureCertificationWithFinalExternalAudit(
      certification,
      byType.get('final_external_audit_v1'),
    );
    result.set(jobId, decision.exposable ? 'certified' : 'blocked');
  }
  return result;
}

/** Read-only, admin-only operational SLO diagnostic. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const days = boundedDays(req.nextUrl.searchParams.get('days'));
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1_000);
  const admin = createAdminClient();

  const { data: rows, error: jobsError } = await admin
    .from('evaluation_jobs')
    .select('id,manuscript_id,job_type,status,created_at,updated_at,completed_at,attempt_count,max_attempts,failure_code')
    .in('status', ['complete', 'completed', 'failed'])
    .gte('updated_at', start.toISOString())
    .lt('updated_at', end.toISOString())
    .order('updated_at', { ascending: false })
    .limit(QUERY_LIMIT);

  if (jobsError) {
    return NextResponse.json({ ok: false, error: jobsError.message }, { status: 500 });
  }

  const jobs = (rows ?? []) as Array<Record<string, unknown>>;
  const completedJobIds = jobs
    .filter((row) => row.status === 'complete' || row.status === 'completed')
    .map((row) => String(row.id));
  const artifacts: ArtifactRow[] = [];

  for (let offset = 0; offset < completedJobIds.length; offset += 100) {
    const ids = completedJobIds.slice(offset, offset + 100);
    const { data, error } = await admin
      .from('evaluation_artifacts')
      .select('job_id,artifact_type,content,created_at')
      .in('job_id', ids)
      .in('artifact_type', ['author_exposure_certification_v1', 'final_external_audit_v1'])
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    artifacts.push(...((data ?? []) as ArtifactRow[]));
  }

  const exposure = exposureByJob(artifacts);
  const input: ReliabilityJob[] = jobs.map((row) => {
    const completed = row.status === 'complete' || row.status === 'completed';
    const manuscriptId = typeof row.manuscript_id === 'number' ? row.manuscript_id : Number(row.manuscript_id);
    return {
      id: String(row.id),
      jobType: typeof row.job_type === 'string' ? row.job_type : null,
      status: String(row.status),
      createdAt: String(row.created_at),
      terminalAt: completed
        ? (typeof row.completed_at === 'string' ? row.completed_at : null)
        : (typeof row.updated_at === 'string' ? row.updated_at : null),
      attemptCount: typeof row.attempt_count === 'number' ? row.attempt_count : null,
      maxAttempts: typeof row.max_attempts === 'number' ? row.max_attempts : null,
      failureCode: typeof row.failure_code === 'string' ? row.failure_code : null,
      exposureState: completed ? (exposure.get(String(row.id)) ?? 'unknown') : 'unknown',
      isTest: Number.isFinite(manuscriptId) && manuscriptId >= TEST_MANUSCRIPT_ID_MIN,
    };
  });

  return NextResponse.json({
    ok: true,
    generatedAt: end.toISOString(),
    source: {
      readOnly: true,
      queryLimit: QUERY_LIMIT,
      truncated: jobs.length === QUERY_LIMIT,
      terminalTimestamp: 'completed_at for completed jobs; updated_at for failed jobs',
    },
    report: aggregateEvaluationReliability(input, {
      start: start.toISOString(),
      end: end.toISOString(),
    }),
  });
}
