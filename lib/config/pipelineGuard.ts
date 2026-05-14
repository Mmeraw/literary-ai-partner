/**
 * Pipeline kill switch — `EVAL_PIPELINE_ENABLED` env guard.
 *
 * Pre-launch operations policy (see OPERATIONS.md): Production is the only
 * environment. Setting `EVAL_PIPELINE_ENABLED=false` in Vercel Production env
 * halts all evaluation work within seconds without a code deploy.
 *
 * Off-by-string-literal "false" is deliberate. We do NOT use truthy/falsy
 * coercion (`!process.env.X`, `Boolean(...)`, etc.) because:
 *   1. Unset env var must mean ENABLED (default behavior on a fresh deploy).
 *   2. Typos like "False" or "FALSE" must NOT silently disable the pipeline.
 *      Case-sensitive literal match prevents accidental disable from typos.
 *   3. Any other value (`"1"`, `"true"`, `"maybe"`, …) keeps the pipeline
 *      ENABLED. The kill switch is opt-in by setting the exact string `"false"`.
 */

export type PipelineSkipResult = {
  ok: false;
  skipped: true;
  reason: 'EVAL_PIPELINE_DISABLED_BY_FLAG';
  job_id: string | null;
};

/**
 * Returns true when the evaluation pipeline should run.
 *
 * Returns false ONLY when `process.env.EVAL_PIPELINE_ENABLED` is the literal
 * string `"false"` (case-sensitive). Every other value — including unset,
 * `"true"`, `"1"`, `"False"`, `"FALSE"`, or any garbage — returns true.
 */
export function isPipelineEnabled(): boolean {
  return process.env.EVAL_PIPELINE_ENABLED !== 'false';
}

/**
 * Canonical skip envelope returned by worker entrypoints when the pipeline
 * is disabled by the kill switch. Workers MUST return this without touching
 * the DB, AI providers, or anything beyond a single one-line warn log.
 */
export function pipelineDisabledResponse(jobId?: string | null): PipelineSkipResult {
  return {
    ok: false,
    skipped: true,
    reason: 'EVAL_PIPELINE_DISABLED_BY_FLAG',
    job_id: jobId ?? null,
  };
}
