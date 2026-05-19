/**
 * app/api/workflows/evaluate/route.ts
 *
 * Trigger endpoint for the durable evaluation workflow.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SPIKE STATUS
 * ─────────────────────────────────────────────────────────────────────
 *
 * This route is NOT active in production. It is gated by the
 * WORKFLOW_EVALUATION_ENABLED env var (default: false).
 *
 * Activation path:
 *   1. Set WORKFLOW_EVALUATION_ENABLED=true in Vercel env vars
 *   2. Update app/api/evaluate/route.ts to call this endpoint instead of
 *      triggerEvaluationWorker when the flag is set
 *   3. Monitor workflow runs via `npx workflow web` or Vercel dashboard
 *      Observability > Workflows
 *
 * ─────────────────────────────────────────────────────────────────────
 * HOW IT WORKS
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1. Caller (evaluate route) creates the evaluation_jobs row as normal
 * 2. Caller POSTs { jobId, traceId } to this endpoint
 * 3. This endpoint calls start(runEvaluationWorkflow, [input]) — async,
 *    returns a run ID immediately
 * 4. The workflow SDK enqueues Step 1 (pass1+pass2) to run in a fresh
 *    Vercel Function
 * 5. On Step 1 completion, SDK automatically enqueues Step 2 (pass3), etc.
 * 6. evaluation_jobs status is updated at the end of each step by
 *    processEvaluationJob (same as today)
 *
 * The caller gets an immediate 202 response with the workflow run ID.
 * No polling or webhooks needed — the workflow manages its own lifecycle.
 */

import { start } from 'workflow/api';
import { generateTraceId } from '@/lib/observability/logger';
import { runEvaluationWorkflow } from '@/workflows/evaluate';

// Feature flag: workflow path is opt-in during rollout
const WORKFLOW_ENABLED =
  process.env.WORKFLOW_EVALUATION_ENABLED === 'true';

export async function POST(req: Request): Promise<Response> {
  if (!WORKFLOW_ENABLED) {
    return Response.json(
      { ok: false, error: 'Workflow evaluation path not enabled' },
      { status: 503 },
    );
  }

  let body: { jobId?: string; traceId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : null;
  const traceId =
    typeof body.traceId === 'string' ? body.traceId.trim() : generateTraceId();

  if (!jobId) {
    return Response.json({ ok: false, error: 'jobId is required' }, { status: 400 });
  }

  // Auth: only internal callers (CRON_SECRET) can trigger workflows
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // start() enqueues the workflow and returns a run handle immediately.
    // The workflow itself runs asynchronously — this endpoint responds before
    // any evaluation work begins.
    const run = await start(runEvaluationWorkflow, [{ jobId, traceId }]);

    console.log(`[WorkflowTrigger] ${jobId}: workflow started`, {
      runId: run.runId,
      traceId,
      event: 'workflow.evaluate.started',
    });

    return Response.json(
      {
        ok: true,
        jobId,
        workflowRunId: run.runId,
        traceId,
      },
      { status: 202 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[WorkflowTrigger] ${jobId}: failed to start workflow`, {
      error: message,
      traceId,
      event: 'workflow.evaluate.start_failed',
    });

    return Response.json(
      { ok: false, error: 'Failed to start evaluation workflow', detail: message },
      { status: 500 },
    );
  }
}
