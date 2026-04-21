/**
 * lib/jobs/triggerWorker.ts
 *
 * Single canonical implementation of best-effort worker kickoff.
 * Used by all job-creation entrypoints so kickoff behavior is uniform:
 * - same HTTP method (GET)
 * - same auth header (Bearer CRON_SECRET)
 * - same observability headers (x-trigger-source, x-job-id, x-trace-id)
 * - same structured logging (warn on skip, warn on non-ok, info on success)
 * - always fire-and-forget (void), never blocks the caller
 * - cron remains the durable fallback
 */
import { logger } from '@/lib/observability/logger';
import {
  finishLatencyStage,
  startLatencyStage,
} from '@/lib/observability/latencyTrace';

export interface TriggerWorkerArgs {
  /** Originating request — used to derive the worker base URL. */
  req: Request;
  /** ID of the job that was just created. */
  jobId: string;
  /** Trace ID propagated from the calling route. */
  trace_id: string;
  /** Request ID propagated from the calling route. */
  request_id: string;
  /** Short label identifying which endpoint fired the kickoff (e.g. 'api.jobs.create'). */
  source: string;
  /** Optional kickoff dispatch start time from caller for end-to-end route->kickoff timing. */
  kickoffDispatchStartedAt?: string;
}

function getConfiguredAppBaseUrl(): string | null {
  const explicit = process.env.WORKER_KICKOFF_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    return appUrl;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
  }

  return null;
}

function buildWorkerUrlFromTrustedOrigin(req: Request): string | null {
  const configuredBase = getConfiguredAppBaseUrl();
  if (configuredBase) {
    return new URL('/api/workers/process-evaluations', configuredBase).toString();
  }

  // Dev/test fallback only: allow request-origin derivation when not in production.
  if (process.env.NODE_ENV !== 'production') {
    return new URL('/api/workers/process-evaluations', req.url).toString();
  }

  return null;
}

/**
 * Fire-and-forget GET to /api/workers/process-evaluations.
 * Always resolves — never throws. Caller must use `void triggerEvaluationWorker(...)`.
 */
export async function triggerEvaluationWorker(
  args: TriggerWorkerArgs,
): Promise<void> {
  const { req, jobId, trace_id, request_id, source, kickoffDispatchStartedAt } = args;

  const kickoffStartAt = startLatencyStage({
    jobId,
    stage: 'worker_kickoff',
    startedAt: kickoffDispatchStartedAt,
    metadata: {
      source,
      trace_id,
      request_id,
      dispatch_gap_ms: kickoffDispatchStartedAt
        ? Math.max(0, Date.now() - Date.parse(kickoffDispatchStartedAt))
        : undefined,
    },
  });

  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    finishLatencyStage({
      jobId,
      stage: 'worker_kickoff',
      startedAt: kickoffStartAt,
      state: 'skipped',
      metadata: {
        finish_reason: 'missing_cron_secret',
        source,
      },
    });

    logger.warn('Worker kickoff skipped: CRON_SECRET not set', {
      trace_id,
      request_id,
      event: 'worker.kickoff.skipped.no_secret',
      job_id: jobId,
      source,
    });
    return;
  }

  const workerUrl = buildWorkerUrlFromTrustedOrigin(req);
  if (!workerUrl) {
    finishLatencyStage({
      jobId,
      stage: 'worker_kickoff',
      startedAt: kickoffStartAt,
      state: 'skipped',
      metadata: {
        finish_reason: 'no_trusted_base_url',
        source,
      },
    });

    logger.warn('Worker kickoff skipped: no trusted app base URL in production', {
      trace_id,
      request_id,
      event: 'worker.kickoff.skipped.no_trusted_base_url',
      job_id: jobId,
      source,
    });
    return;
  }

  try {
    const response = await fetch(workerUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        'x-trigger-source': source,
        'x-job-id': jobId,
        'x-trace-id': trace_id,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      finishLatencyStage({
        jobId,
        stage: 'worker_kickoff',
        startedAt: kickoffStartAt,
        state: 'failed',
        metadata: {
          finish_reason: 'non_ok_response',
          worker_status: response.status,
          source,
        },
      });

      logger.warn('Worker kickoff returned non-ok response', {
        trace_id,
        request_id,
        event: 'worker.kickoff.non_ok',
        job_id: jobId,
        source,
        worker_status: response.status,
        worker_url: workerUrl,
      });
      return;
    }

    finishLatencyStage({
      jobId,
      stage: 'worker_kickoff',
      startedAt: kickoffStartAt,
      state: 'dispatched',
      metadata: {
        finish_reason: 'ok_response',
        source,
      },
    });

    logger.info('Worker kickoff dispatched', {
      trace_id,
      request_id,
      event: 'worker.kickoff.dispatched',
      job_id: jobId,
      source,
      worker_url: workerUrl,
    });
  } catch (error) {
    finishLatencyStage({
      jobId,
      stage: 'worker_kickoff',
      startedAt: kickoffStartAt,
      state: 'failed',
      metadata: {
        finish_reason: 'network_or_timeout',
        source,
      },
    });

    logger.warn('Worker kickoff failed (network/timeout)', {
      trace_id,
      request_id,
      event: 'worker.kickoff.failed',
      job_id: jobId,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
