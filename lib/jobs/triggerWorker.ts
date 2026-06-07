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

export type TriggerWorkerResult =
  | {
      ok: true;
      workerStatus: number;
      claimed: number | null;
      processed: number | null;
      targetClaimed: boolean | null;
      body: Record<string, unknown> | null;
    }
  | {
      ok: false;
      reason:
        | 'missing_cron_secret'
        | 'no_trusted_base_url'
        | 'non_ok_response'
        | 'network_or_timeout'
        | 'worker_rejected'
        | 'worker_halted';
      workerStatus?: number;
      error?: string;
      body?: Record<string, unknown> | null;
    };

/**
 * Type guard for the failure variant of TriggerWorkerResult.
 *
 * Use this instead of `!result.ok` for discriminated-union narrowing so that
 * Next.js production type checking (which runs tsc in a separate worker process
 * with stricter control-flow analysis) accepts `.reason` / `.error` accesses.
 *
 * Pattern for every kickoff caller:
 *
 *   const reason = isTriggerWorkerFailure(kickoffResult)
 *     ? (kickoffResult.error ?? kickoffResult.reason)
 *     : targetClaimFailed
 *       ? 'worker_did_not_claim_created_job'
 *       : 'worker_returned_zero_claims';
 */
export function isTriggerWorkerFailure(
  result: TriggerWorkerResult,
): result is Extract<TriggerWorkerResult, { ok: false }> {
  return !result.ok;
}

export function getConfiguredAppBaseUrl(): string | null {
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

  if (process.env.NODE_ENV === 'production') {
    // Mistake-proof production fallback: if deployment envs are missing,
    // still dispatch to the canonical public hostname instead of silently
    // stranding newly created jobs in queued state.
    return 'https://www.revisiongrade.com';
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
 * GET /api/workers/process-evaluations.
 * Always resolves — never throws. Callers that create user-visible jobs should
 * inspect the returned result and fail closed if the worker did not accept work.
 */
export async function triggerEvaluationWorker(
  args: TriggerWorkerArgs,
): Promise<TriggerWorkerResult> {
  const { req, jobId, trace_id, request_id, source, kickoffDispatchStartedAt } = args;

  const kickoffStartAt = startLatencyStage({
    jobId,
    stage: 'worker_kickoff',
    startedAt: kickoffDispatchStartedAt,
    metadata: {
      source,
      trace_id,
      request_id,
      dispatch_gap_ms: (() => {
        if (!kickoffDispatchStartedAt) return undefined;
        const parsed = Date.parse(kickoffDispatchStartedAt);
        return Number.isFinite(parsed) ? Math.max(0, Date.now() - parsed) : undefined;
      })(),
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
    return { ok: false, reason: 'missing_cron_secret' };
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
    return { ok: false, reason: 'no_trusted_base_url' };
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

    const body = await response.json().catch(() => null) as Record<string, unknown> | null;

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
        worker_body: body,
      });
      return { ok: false, reason: 'non_ok_response', workerStatus: response.status, body };
    }

    if (body?.success === false) {
      finishLatencyStage({
        jobId,
        stage: 'worker_kickoff',
        startedAt: kickoffStartAt,
        state: 'failed',
        metadata: {
          finish_reason: 'worker_rejected',
          worker_status: response.status,
          source,
        },
      });

      logger.warn('Worker kickoff rejected by worker response', {
        trace_id,
        request_id,
        event: 'worker.kickoff.rejected',
        job_id: jobId,
        source,
        worker_status: response.status,
        worker_url: workerUrl,
        worker_body: body,
      });
      return { ok: false, reason: 'worker_rejected', workerStatus: response.status, body };
    }

    if (body?.halted === true || body?.disabled === true) {
      finishLatencyStage({
        jobId,
        stage: 'worker_kickoff',
        startedAt: kickoffStartAt,
        state: 'failed',
        metadata: {
          finish_reason: 'worker_halted',
          worker_status: response.status,
          source,
          reason: body?.reason,
        },
      });

      logger.warn('Worker kickoff halted by worker configuration', {
        trace_id,
        request_id,
        event: 'worker.kickoff.halted',
        job_id: jobId,
        source,
        worker_status: response.status,
        worker_url: workerUrl,
        worker_body: body,
      });
      return { ok: false, reason: 'worker_halted', workerStatus: response.status, body };
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
      claimed: typeof body?.claimed === 'number' ? body.claimed : null,
      processed: typeof body?.processed === 'number' ? body.processed : null,
      targetClaimed: typeof body?.targetClaimed === 'boolean' ? body.targetClaimed : null,
    });

    return {
      ok: true,
      workerStatus: response.status,
      claimed: typeof body?.claimed === 'number' ? body.claimed : null,
      processed: typeof body?.processed === 'number' ? body.processed : null,
      targetClaimed: typeof body?.targetClaimed === 'boolean' ? body.targetClaimed : null,
      body,
    };
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
    return {
      ok: false,
      reason: 'network_or_timeout',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
