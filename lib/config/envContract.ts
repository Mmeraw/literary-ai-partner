import 'server-only';
/**
 * envContract.ts
 *
 * Canonical environment contract for evaluation-altering env inputs.
 * This module owns the evaluation-behavior inputs:
 *   - EVAL_PIPELINE_INPUT_CHAR_BUDGET
 *   - EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET
 *   - EVAL_OPENAI_MODEL
 *   - EVAL_EXTERNAL_ADJUDICATION_MODE
 *   - ENABLE_LATENCY_TRACE_LOGS
 *   - USE_REAL_LLM
 *   - NODE_ENV
 *   - Vercel platform signals (VERCEL_ENV, CI)
 *
 * Auth/database/runtime secrets are documented in the registry below
 * for reference only. Those values are still read directly by the modules
 * that consume them until the hot-path adoption PR lands.
 *
 * NOTE: import 'server-only' at the top prevents client bundle inclusion.
 * PERPLEXITY_API_KEY is only required when adjudicationMode is 'required' or 'veto'.
 * SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL alias handling is documented
 * below but not enforced until the hot-path adoption PR.
 */

export type AdjudicationMode = 'optional' | 'required' | 'veto';
export type NodeEnv = 'development' | 'test' | 'production';

export interface EvalEnvContract {
  // --- Evaluation-behavior inputs (owned by this contract) ---
  inputCharBudget: number;
  synthesisRefCharBudget: number;
  openAiModel: string;
  adjudicationMode: AdjudicationMode;
  latencyTraceEnabled: boolean;
  nodeEnv: NodeEnv;
  isEvidenceMode: boolean;

  // --- Conditional requirement flag ---
  /** True when adjudicationMode is 'required' or 'veto': PERPLEXITY_API_KEY must be set. */
  requiresPerplexityApiKey: boolean;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_ADJUDICATION_MODES: AdjudicationMode[] = ['optional', 'required', 'veto'];
const VALID_NODE_ENVS: NodeEnv[] = ['development', 'test', 'production'];

const INPUT_CHAR_BUDGET_MIN = 12_000;
const INPUT_CHAR_BUDGET_MAX = 100_000;
// Raised from 40_000 → 50_000 so the chunker post-condition
// (chunk ≤ floor(inputCharBudget * 0.95) = 47_500) accommodates the LARGE
// adaptive bracket's emitted-content ceiling (chunking.ts BRACKET_LARGE
// maxChars=42_000). Without this, 150k+ word manuscripts fail closed at
// Pass 1 dispatch with CHUNK_BUDGET_OVERFLOW (e.g. job a8d3723c). Pass 1
// model windows (gpt-5.1) are >> 50_000 chars so this is a budgeting
// alignment, not a token-window expansion. Per-chunk prompt cost grows by
// at most ~25% on the largest chunks. Invariant asserted in
// lib/evaluation/pipeline/__tests__/chunker-budget-invariant.test.ts.
const INPUT_CHAR_BUDGET_DEFAULT = 50_000;

const SYNTHESIS_REF_CHAR_BUDGET_MIN = 1_000;
// Raised from 50_000: gpt-5 / gpt-5.1 context windows are large enough to
// hold a full-length novel manuscript (600k+ chars). Pass 3 was producing
// false recommendations because it only saw 1-2% of the text. The 50k cap
// was a holdover from gpt-4 8k/32k era. 600_000 chars ~= 150k tokens which
// fits comfortably within gpt-5's context window.
const SYNTHESIS_REF_CHAR_BUDGET_MAX = 600_000;
// Default raised to 400k to cover full-length novels. Operators can lower
// via EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET for cost control on short works.
const SYNTHESIS_REF_CHAR_BUDGET_DEFAULT = 400_000;

const OPENAI_MODEL_DEFAULT = 'gpt-5.1';

/**
 * Parse a strict positive integer from an env string.
 * Rejects floats, partially-numeric strings (e.g. '60000ms'), and out-of-range values.
 */
function parseStrictPositiveInt(
  key: string,
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  // Reject any value that is not a pure integer string (digits only, optional leading minus)
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new Error(
      `[envContract] ${key} must be a plain integer, got: ${JSON.stringify(raw)}`
    );
  }
  const n = parseInt(raw.trim(), 10);
  if (isNaN(n) || n < min || n > max) {
    throw new Error(
      `[envContract] ${key} must be between ${min} and ${max}, got: ${n}`
    );
  }
  return n;
}

function requireNonEmpty(key: string, raw: string | undefined): string {
  if (!raw || raw.trim() === '') {
    throw new Error(
      `[envContract] ${key} is required but was empty or missing.`
    );
  }
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Forbidden combination guards
// ---------------------------------------------------------------------------

function assertNotForbiddenCombinations(env: NodeJS.ProcessEnv): void {
  const isVercelProd = env.VERCEL_ENV === 'production';
  if (isVercelProd && env.CI === 'true') {
    throw new Error('[envContract] CI=true is not permitted in Vercel production.');
  }
  if (isVercelProd && env.NODE_ENV === 'test') {
    throw new Error('[envContract] NODE_ENV=test is not permitted in Vercel production.');
  }
  if (isVercelProd && env.FLOW1_EVIDENCE === '1') {
    throw new Error('[envContract] FLOW1_EVIDENCE=1 is not permitted in Vercel production.');
  }
  if (isVercelProd && env.FLOW_A7_EVIDENCE === '1') {
    throw new Error('[envContract] FLOW_A7_EVIDENCE=1 is not permitted in Vercel production.');
  }
  if (env.USE_REAL_LLM === 'true') {
    throw new Error('[envContract] USE_REAL_LLM=true is never permitted. Use the canonical pipeline path.');
  }
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

export function resolveEvalEnvContract(
  env: NodeJS.ProcessEnv = process.env
): EvalEnvContract {
  assertNotForbiddenCombinations(env);

  const inputCharBudget = parseStrictPositiveInt(
    'EVAL_PIPELINE_INPUT_CHAR_BUDGET',
    env.EVAL_PIPELINE_INPUT_CHAR_BUDGET,
    INPUT_CHAR_BUDGET_DEFAULT,
    INPUT_CHAR_BUDGET_MIN,
    INPUT_CHAR_BUDGET_MAX
  );

  const synthesisRefCharBudget = parseStrictPositiveInt(
    'EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET',
    env.EVAL_PIPELINE_SYNTHESIS_REF_CHAR_BUDGET,
    SYNTHESIS_REF_CHAR_BUDGET_DEFAULT,
    SYNTHESIS_REF_CHAR_BUDGET_MIN,
    SYNTHESIS_REF_CHAR_BUDGET_MAX
  );

  const openAiModel = env.EVAL_OPENAI_MODEL?.trim() || OPENAI_MODEL_DEFAULT;
  if (openAiModel === '') {
    throw new Error('[envContract] EVAL_OPENAI_MODEL is set but blank.');
  }
  // Re-validate after trim: if the original was set but whitespace-only, openAiModel
  // would have fallen back to default, which is fine. But if explicitly set to a
  // non-empty value, we accept it as-is.
  const resolvedModel = env.EVAL_OPENAI_MODEL !== undefined && env.EVAL_OPENAI_MODEL.trim() !== ''
    ? requireNonEmpty('EVAL_OPENAI_MODEL', env.EVAL_OPENAI_MODEL)
    : OPENAI_MODEL_DEFAULT;

  // Premium-product default: when running on Vercel production, the two-AI
  // adjudicated evaluation is the contract. If EVAL_EXTERNAL_ADJUDICATION_MODE is
  // unset on Vercel prod we default to 'required' so the runtime fails fast on
  // a missing PERPLEXITY_API_KEY instead of silently dropping Pass 4. Dev/test
  // and Vercel preview continue to default to 'optional' so local CI and PR
  // previews don't require a Perplexity key.
  const isVercelProductionForMode = env.VERCEL_ENV === 'production';
  const adjudicationDefault: AdjudicationMode = isVercelProductionForMode ? 'required' : 'optional';
  const rawMode = env.EVAL_EXTERNAL_ADJUDICATION_MODE?.trim() ?? adjudicationDefault;
  if (!VALID_ADJUDICATION_MODES.includes(rawMode as AdjudicationMode)) {
    throw new Error(
      `[envContract] EVAL_EXTERNAL_ADJUDICATION_MODE must be one of ${VALID_ADJUDICATION_MODES.join('|')}, got: ${JSON.stringify(rawMode)}`
    );
  }
  const adjudicationMode = rawMode as AdjudicationMode;

  const rawNodeEnv = (env.NODE_ENV?.trim() ?? 'development');
  if (!VALID_NODE_ENVS.includes(rawNodeEnv as NodeEnv)) {
    throw new Error(
      `[envContract] NODE_ENV must be one of ${VALID_NODE_ENVS.join('|')}, got: ${JSON.stringify(rawNodeEnv)}`
    );
  }
  const nodeEnv = rawNodeEnv as NodeEnv;

  const normalizedResolvedModel = resolvedModel.trim().toLowerCase();
  if (
    nodeEnv === 'production' &&
    /^o[0-9]/.test(normalizedResolvedModel) &&
    env.EVAL_ALLOW_REASONING_MODELS !== 'true'
  ) {
    throw new Error(
      `[envContract] reasoning model '${resolvedModel}' is not permitted in production; set EVAL_ALLOW_REASONING_MODELS=true only for explicit overrides.`,
    );
  }

  const latencyTraceEnabled = env.ENABLE_LATENCY_TRACE_LOGS === '1';

  const isEvidenceMode =
    env.CI === 'true' ||
    env.NODE_ENV === 'test' ||
    env.FLOW1_EVIDENCE === '1' ||
    env.FLOW_A7_EVIDENCE === '1';

  const requiresPerplexityApiKey =
    adjudicationMode === 'required' || adjudicationMode === 'veto';

  return {
    inputCharBudget,
    synthesisRefCharBudget,
    openAiModel: resolvedModel,
    adjudicationMode,
    latencyTraceEnabled,
    nodeEnv,
    isEvidenceMode,
    requiresPerplexityApiKey,
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _contract: EvalEnvContract | undefined;

export function getEvalEnvContract(): EvalEnvContract {
  if (!_contract) {
    _contract = resolveEvalEnvContract();
  }
  return _contract;
}

/** Test helper — reset the singleton between test runs. */
export function __resetEvalEnvContract(): void {
  _contract = undefined;
}

// ---------------------------------------------------------------------------
// ENV VAR REGISTRY
// (reference map for evaluation and adjacent runtime signals)
// This section documents variables consumed elsewhere in the pipeline.
// resolveEvalEnvContract() owns the evaluation-behavior inputs above.
// Auth/database/runtime secrets below are documented here so the contract
// stays discoverable, but those values are still validated by the modules
// that consume them until the hot-path adoption PR lands.
// ---------------------------------------------------------------------------
//
// Variable                        Classification    Notes
// ----------------------------------------------------------------
// OPENAI_API_KEY                  required-server   OpenAI completions
// PERPLEXITY_API_KEY              conditional       Required only when adjudicationMode='required'|'veto'
// SUPABASE_URL                    required-server   Supabase project URL
//   (alias: NEXT_PUBLIC_SUPABASE_URL in some client paths — see docs/env-contract.md)
// SUPABASE_SERVICE_ROLE_KEY       required-server   Must never reach client bundle
// NEXT_PUBLIC_SUPABASE_ANON_KEY   required-client   Safe for browser
// VERCEL_ENV                      platform          'production'|'preview'|'development'
// CI                              platform          'true' in CI runners
// FLOW1_EVIDENCE                  evidence-mode     '1' during evidence collection runs
// FLOW_A7_EVIDENCE                evidence-mode     '1' during A7 evidence runs
// USE_REAL_LLM                    forbidden         Never permitted; always throws
// ENABLE_LATENCY_TRACE_LOGS       optional          '1' enables latency trace output
