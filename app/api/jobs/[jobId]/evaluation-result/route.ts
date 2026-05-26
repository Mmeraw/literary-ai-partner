import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { canReleaseEvaluationRead } from '@/lib/jobs/readReleaseGate';
import { EvaluationResultV1, isEvaluationResultV1, validateEvaluationResult } from '@/schemas/evaluation-result-v1';
import { EvaluationResultV2, isEvaluationResultV2, validateEvaluationResultV2 } from '@/schemas/evaluation-result-v2';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: job, error } = await supabase
      .from('evaluation_jobs')
      .select('id, manuscript_id, status, validity_status, evaluation_result, evaluation_result_version, created_at, updated_at')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    if (!canReleaseEvaluationRead(job) || !job.evaluation_result) {
      return NextResponse.json(
        {
          error: 'Evaluation not releasable',
          job: {
            id: job.id,
            status: job.status,
            validity_status: job.validity_status,
            created_at: job.created_at,
          },
        },
        { status: 404 },
      );
    }

    const result = job.evaluation_result as unknown;
    const isV1 = isEvaluationResultV1(result);
    const isV2 = isEvaluationResultV2(result);

    if (!isV1 && !isV2) {
      return NextResponse.json({ error: 'Invalid evaluation result format' }, { status: 500 });
    }

    const validation = isV2
      ? validateEvaluationResultV2(result as EvaluationResultV2)
      : validateEvaluationResult(result as EvaluationResultV1);

    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
      return NextResponse.json(
        {
          error: 'Evaluation result validation failed',
          validation_errors: validation.errors,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      job_id: job.id,
      manuscript_id: job.manuscript_id,
      status: job.status,
      validity_status: job.validity_status,
      result,
      result_version: job.evaluation_result_version,
      created_at: job.created_at,
      updated_at: job.updated_at,
    });
  } catch (error) {
    console.error('Error fetching evaluation result:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
