/**
 * lib/jobs/triggerWorkflow.ts
 *
 * Fire-and-forget POST to /api/workflows/evaluate.
 * Used when WORKFLOW_EVALUATION_ENABLED=true — each phase gets a fresh
 * 800s Vercel Function budget; the overall workflow has no duration limit.
 *
 * Mirrors triggerWorker.ts conventions:
 *   - same auth header (Bearer CRON_SECRET)
 *   - same observability headers
 *   - always fire-and-forget (void), never blocks the caller
 *   - cron remains the durable fallback if this kickoff fails
 */
import { logger } from '@/lib/observability/logger';
import {
  finishLatencyStage,
  startLatencyStage,
} from '@/lib/observability/latencyTrace';

export interface TriggerWorkflowArgs {
  req: Request;
  jobId: string;
  trace_id: string;
  request_id: string;
  source: string;
  kickoffDispatchStartedAt?: string;
}

function getConfiguredAppBaseUrl(): string | null {
  const explicit = process.env.WORKER_KICKOFF_BASE_URL?.trim();
  if (explicit) return explicit;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl;

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;

  return null;
}

function buildWorkflowUrl(req: Request): string | null {
  const configuredBase = getConfiguredAppBaseUrl();
  if (configuredBase) {
    return new URL('/api/workflows/evaluate', configuredBase).toString();
  }

  if (process.env.NODE_ENV !== 'production') {
    return new URL('/api/workflows/evaluate', req.url).toString();
  }

  return null;
}

/**
 * Fire-and-forget POST to /api/workflows/evaluate.
 * Always resolves — never throws. Caller must use `void triggerEvaluationWorkflow(...)`.
 */
export async function triggerEvaluationWorkflow(
  args: TriggerWorkflowArgs,
): Promise<void> {
  const { req, jobId, trace_id, request_id, source, kickoffDispatchStartedAt } = args;

  const kickoffStartAt = startLatencyStage({
    jobId,
    stage: 'workflow_kickoff',
    startedAt: kickoffDispatchStartedAt,
    metadata: { source, trace_id, request_id },
  });

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    finishLatencyStage({
      jobId,
      stage: 'workflow_kickoff',
      startedAt: kickoffStartAt,
      state: 'skipped',
      metadata: { finish_reason: 'missing_cron_secret', source },
    });
    logger.warn('Workflow kickoff skipped: CRON_SECRET not set', {
      trace_id, request_id, event: 'workflow.kickoff.skipped.no_secret', job_id: jobId, source,
    });
    return;
  }

  const workflowUrl = buildWorkflowUrl(req);
  if (!workflowUrl) {
    finishLatencyStage({
      jobId,
      stage: 'workflow_kickoff',
      startedAt: kickoffStartAt,
      state: 'skipped',
      metadata: { finish_reason: 'no_trusted_base_url', source },
    });
    logger.warn('Workflow kickoff skipped: no trusted app base URL in production', {
      trace_id, request_id, event: 'workflow.kickoff.skipped.no_trusted_base_url', job_id: jobId, source,
    });
    return;
  }

  try {
    const response = await fetch(workflowUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
        'x-trigger-source': source,
        'x-job-id': jobId,
        'x-trace-id': trace_id,
      },
      body: JSON.stringify({ jobId, traceId: trace_id }),
      cache: 'no-store',
    });

    if (!response.ok) {
      finishLatencyStage({
        jobId,
        stage: 'workflow_kickoff',
        startedAt: kickoffStartAt,
        state: 'failed',
        metadata: { finish_reason: 'non_ok_response', workflow_status: response.status, source },
      });
      logger.warn('Workflow kickoff returned non-ok response', {
        trace_id, request_id, event: 'workflow.kickoff.non_ok',
        job_id: jobId, source, workflow_status: response.status, workflow_url: workflowUrl,
      });
      return;
    }

    finishLatencyStage({
      jobId,
      stage: 'workflow_kickoff',
      startedAt: kickoffStartAt,
      state: 'dispatched',
      metadata: { finish_reason: 'ok_response', source },
    });
    logger.info('Workflow kickoff dispatched', {
      trace_id, request_id, event: 'workflow.kickoff.dispatched',
      job_id: jobId, source, workflow_url: workflowUrl,
    });
  } catch (error) {
    finishLatencyStage({
      jobId,
      stage: 'workflow_kickoff',
      startedAt: kickoffStartAt,
      state: 'failed',
      metadata: { finish_reason: 'network_or_timeout', source },
    });
    logger.warn('Workflow kickoff failed (network/timeout)', {
      trace_id, request_id, event: 'workflow.kickoff.failed',
      job_id: jobId, source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
