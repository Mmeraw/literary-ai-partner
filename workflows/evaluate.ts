/**
 * workflows/evaluate.ts
 *
 * Durable evaluation workflow using Vercel Workflow SDK.
 *
 * ─────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────
 *
 * This is the target architecture for RevisionGrade evaluations.
 * It replaces the current phase_1 / phase_2 invocation split with a
 * single durable workflow run that pauses, resumes, and survives
 * Vercel restarts without any application-level orchestration.
 *
 * What this eliminates (once fully adopted + processor.ts extended):
 *   - pass12_handoff_v1 artifact pattern
 *   - phase_1 / phase_2 routing in processor.ts
 *   - Guard D watchdog rescue logic
 *   - setInterval-based heartbeat (and the forced-chunk heartbeat in #601)
 *   - EVAL_STALE_RUNNING_MINUTES / EVAL_FROZEN_HEARTBEAT_SECS env vars
 *
 * What stays unchanged:
 *   - All chunk runners (runPass1, runPass2) — no logic change
 *   - All OpenAI calls, prompts, scoring
 *   - QualityGateV2
 *   - Supabase evaluation_jobs table (used for UI state / user-facing status)
 *   - Report generation
 *
 * ─────────────────────────────────────────────────────────────────────
 * DURATION
 * ─────────────────────────────────────────────────────────────────────
 *
 * Each 'use step' function runs inside a standard Vercel Function with
 * the normal 800s ceiling. But the *workflow* itself has no duration
 * limit — it pauses between steps via Vercel Workflows managed
 * persistence and resumes when the next step is ready.
 *
 * For a 40-chunk job:
 *   step 1 (pass1+pass2): ~10-13 min  → within one 800s function
 *   step 2 (pass3):       ~2-4 min    → fresh 800s function
 *   step 3 (pass4+QG):   ~1-2 min    → fresh 800s function
 *
 * Total wall time unchanged (~20-24 min), but each step gets a full
 * fresh 800s budget with no shared lease pressure between phases.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SPIKE STATUS
 * ─────────────────────────────────────────────────────────────────────
 *
 * RFC/proof-of-concept only — NOT wired into production routing.
 * Phase references below (phase_1/phase_2) describe the OLD architecture;
 * current production uses phase_1a → phase_2 → phase_3 relay race.
 * Gated by WORKFLOW_EVALUATION_ENABLED=true (default: false).
 *
 * Current approach: each step calls processEvaluationJob(jobId) normally.
 * The processor's existing phase routing handles step boundaries:
 *   - Step 1 calls processor in phase_1 context → Pass1+Pass2 → handoff
 *   - Step 2 calls processor in phase_2 context → Pass3+Pass4 → report
 *
 * Future: extend processEvaluationJob with executionHint to give the
 * workflow finer-grained step boundaries (pass3 separate from pass4+QG).
 *
 * ─────────────────────────────────────────────────────────────────────
 * DIRECTIVE NOTE
 * ─────────────────────────────────────────────────────────────────────
 *
 * The 'use workflow' and 'use step' directives are compile-time transforms
 * applied by withWorkflow() in next.config.mjs. TypeScript sees them as
 * plain string literals (no type error). The SDK's swc plugin rewrites
 * them at build time into the workflow runtime calls.
 */

import { processEvaluationJob } from '@/lib/evaluation/processor';
import { generateTraceId } from '@/lib/observability/logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EvaluationWorkflowInput {
  /** evaluation_jobs.id (UUID) */
  jobId: string;
  /** Trace ID propagated from the originating evaluate request */
  traceId?: string;
}

export interface EvaluationWorkflowResult {
  jobId: string;
  status: 'completed' | 'failed';
  completedAt: string;
  durationMs: number;
}

// ── Workflow ─────────────────────────────────────────────────────────────────

/**
 * Durable evaluation workflow.
 *
 * Orchestrates Phase 1 (Pass1+Pass2 chunk sweeps) → Phase 2 (Pass3+Pass4+QG)
 * as separate durable steps. Each step gets a fresh 800s Vercel Function budget.
 * The workflow itself has no duration limit.
 *
 * Corresponds to the existing phase_1 / phase_2 split, but without the fragile
 * application-level orchestration — the SDK manages pause, resume, and retry.
 */
export async function runEvaluationWorkflow(
  input: EvaluationWorkflowInput,
): Promise<EvaluationWorkflowResult> {
  'use workflow';

  const { jobId, traceId = generateTraceId() } = input;
  const workflowStartMs = Date.now();

  console.log(`[EvalWorkflow] ${jobId}: workflow started`, { traceId });

  // ── Step 1: Phase 1 — Pass1 + Pass2 (parallel chunk sweeps) ──────────
  //
  // Calls the existing processor in phase_1 context. The processor:
  //   - Claims the job (status → running, phase_1)
  //   - Runs Pass1 + Pass2 as Promise.allSettled (already parallel)
  //   - Writes pass12_handoff_v1 artifact
  //   - Transitions job to status=queued, phase=phase_2
  //
  // This step gets its own fresh 800s Vercel Function budget.
  // If it fails, the SDK retries this step (not the whole workflow).
  const phase1Result = await runPhase1Step({ jobId, traceId });

  console.log(`[EvalWorkflow] ${jobId}: phase 1 complete`, {
    success: phase1Result.success,
    traceId,
  });

  if (!phase1Result.success) {
    const durationMs = Date.now() - workflowStartMs;
    return { jobId, status: 'failed', completedAt: new Date().toISOString(), durationMs };
  }

  // ── Step 2: Phase 2 — Pass3 + Pass4 + QualityGate + Report ──────────
  //
  // Calls the existing processor in phase_2 context. The processor:
  //   - Claims the job (status → running, phase_2)
  //   - Reads the pass12_handoff_v1 artifact written in Step 1
  //   - Runs Pass3 synthesis → Pass4 governance → QualityGateV2 → report
  //   - Sets job status → completed (or failed on QG rejection)
  //
  // Fresh 800s budget — no budget pressure from Phase 1.
  const phase2Result = await runPhase2Step({ jobId, traceId });

  console.log(`[EvalWorkflow] ${jobId}: phase 2 complete`, {
    success: phase2Result.success,
    traceId,
  });

  const durationMs = Date.now() - workflowStartMs;

  return {
    jobId,
    status: phase2Result.success ? 'completed' : 'failed',
    completedAt: new Date().toISOString(),
    durationMs,
  };
}

// ── Steps ─────────────────────────────────────────────────────────────────────

/**
 * Step 1: Phase 1 — Pass1 + Pass2 chunk sweeps.
 *
 * Delegates to the existing processEvaluationJob() which already knows how
 * to run phase_1 (claims the job, runs Pass1+Pass2, writes handoff artifact,
 * transitions to phase_2/queued).
 *
 * Gets a fresh 800s Vercel Function budget.
 * SDK auto-retries on unhandled error.
 */
async function runPhase1Step(args: {
  jobId: string;
  traceId: string;
}): Promise<{ success: boolean; error?: string }> {
  'use step';

  const { jobId, traceId } = args;
  console.log(`[EvalWorkflow][Step:phase1] ${jobId}: starting (traceId=${traceId})`);

  try {
    const result = await processEvaluationJob(jobId);

    if (!result.success && !result.skipped) {
      console.error(`[EvalWorkflow][Step:phase1] ${jobId}: processEvaluationJob failed`, {
        error: result.error,
      });
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[EvalWorkflow][Step:phase1] ${jobId}: unexpected error`, { error: message });
    throw err; // let SDK retry
  }
}

/**
 * Step 2: Phase 2 — Pass3 + Pass4 + QualityGate + Report finalization.
 *
 * The processor's phase_2 path reads the pass12_handoff_v1 artifact from
 * Step 1, runs Pass3 synthesis, Pass4 governance, QualityGateV2, and
 * writes the final report artifact.
 *
 * Gets a fresh 800s Vercel Function budget.
 * SDK auto-retries on unhandled error.
 */
async function runPhase2Step(args: {
  jobId: string;
  traceId: string;
}): Promise<{ success: boolean; error?: string }> {
  'use step';

  const { jobId, traceId } = args;
  console.log(`[EvalWorkflow][Step:phase2] ${jobId}: starting (traceId=${traceId})`);

  try {
    const result = await processEvaluationJob(jobId);

    if (!result.success && !result.skipped) {
      console.error(`[EvalWorkflow][Step:phase2] ${jobId}: processEvaluationJob failed`, {
        error: result.error,
      });
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[EvalWorkflow][Step:phase2] ${jobId}: unexpected error`, { error: message });
    throw err; // let SDK retry
  }
}
