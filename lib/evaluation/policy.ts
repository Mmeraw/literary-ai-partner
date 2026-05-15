export type OpenAIOutputTokenParam = {
  max_tokens?: number;
  max_completion_tokens?: number;
};

/**
 * Centralized OpenAI SDK transport retry ceiling.
 * Keep low and explicit to avoid hidden multi-retry latency amplification.
 */
export const OPENAI_SDK_MAX_RETRIES = 1;

export type OpenAITemperatureParam = {
  temperature?: number;
};

export type ExternalAdjudicationMode = "optional" | "required" | "veto";

import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";

export function isReasoningStyleModel(model: string): boolean {
  const normalizedModel = model.trim().toLowerCase();
  return (
    normalizedModel.startsWith("o1") ||
    normalizedModel.startsWith("o3") ||
    normalizedModel.startsWith("o4") ||
    normalizedModel.startsWith("gpt-5")
  );
}

/**
 * Per-model hard cap on completion tokens, enforced at the API boundary.
 *
 * The OpenAI API rejects requests where max_tokens / max_completion_tokens
 * exceeds the model's per-request output limit (HTTP 400 invalid_request_error,
 * "max_tokens too large"). Our internal config (e.g. pass3MaxTokens=20000) is
 * intentionally not lowered to the smallest cap because callers may legitimately
 * be running against a larger-cap model. Instead, the cap is applied once, here,
 * at the structural boundary between our config and the SDK call.
 *
 * Caps reflect documented model maximums. Unknown models intentionally pass
 * through unclamped — better to surface a 400 than to silently truncate when
 * we don't know the model's real cap.
 *
 * Sources: OpenAI model pages and community-confirmed 400 errors.
 */
export const MODEL_COMPLETION_TOKEN_CAPS: Readonly<Record<string, number>> = Object.freeze({
  "gpt-4o": 16384,
  "gpt-4o-2024-08-06": 16384,
  "gpt-4o-2024-11-20": 16384,
  "gpt-4o-mini": 16384,
  "gpt-4o-mini-2024-07-18": 16384,
  "gpt-4-turbo": 4096,
  "gpt-4-turbo-2024-04-09": 4096,
  "gpt-4-turbo-preview": 4096,
  "gpt-4-1106-preview": 4096,
  "gpt-4-0125-preview": 4096,
  "gpt-5.1": 128000,
  "gpt-5.1-chat-latest": 128000,
  "gpt-5.1-codex-max": 128000,
});

/**
 * Returns the per-request completion-token cap for a known model, or `null`
 * for unknown models (passthrough — no clamping). Match is case-insensitive
 * on the trimmed model name.
 */
export function getModelCompletionTokenCap(model: string): number | null {
  const normalized = model.trim().toLowerCase();
  if (normalized.length === 0) return null;
  return MODEL_COMPLETION_TOKEN_CAPS[normalized] ?? null;
}

export function buildOpenAIOutputTokenParam(
  model: string,
  maxOutputTokens: number,
): OpenAIOutputTokenParam {
  const cap = getModelCompletionTokenCap(model);
  let effective = maxOutputTokens;
  if (cap !== null && maxOutputTokens > cap) {
    console.warn(
      `[policy] buildOpenAIOutputTokenParam: clamping max_tokens from ${maxOutputTokens} to per-model cap ${cap} for model "${model}"`,
    );
    effective = cap;
  }
  return isReasoningStyleModel(model)
    ? { max_completion_tokens: effective }
    : { max_tokens: effective };
}

export function buildOpenAITemperatureParam(
  model: string,
  temperature: number,
): OpenAITemperatureParam {
  return isReasoningStyleModel(model) ? {} : { temperature };
}

/**
 * Resolves the model used by every evaluation pipeline pass.
 *
 * Resolution order:
 *   1. Caller-supplied non-empty `overrideModel` (after trim).
 *   2. `getEvaluationRuntimeConfig().model` (driven by EVAL_OPENAI_MODEL).
 *
 * Production invariant:
 *   Reasoning-style models (o1/o3/o4/...) are forbidden in production
 *   unless explicitly allowed via EVAL_ALLOW_REASONING_MODELS=true.
 *   Single point of enforcement for the policy:
 *     "No reasoning models in deterministic production pipelines."
 */
export function getCanonicalPipelineModel(overrideModel?: string): string {
  const candidate =
    typeof overrideModel === "string" && overrideModel.trim().length > 0
      ? overrideModel.trim()
      : getEvaluationRuntimeConfig().model;

  const normalizedCandidate = candidate.trim().toLowerCase();

  if (
    process.env.NODE_ENV === "production" &&
    /^o[0-9]/.test(normalizedCandidate) &&
    process.env.EVAL_ALLOW_REASONING_MODELS !== "true"
  ) {
    throw new Error(
      `[Config] reasoning model '${candidate}' not permitted in production`,
    );
  }

  return candidate;
}

function resolveEnvBackedModel(envKeys: string[], overrideModel?: string): string {
  for (const envKey of envKeys) {
    const envValue = process.env[envKey];
    if (typeof envValue === "string" && envValue.trim().length > 0) {
      return getCanonicalPipelineModel(envValue);
    }
  }

  return getCanonicalPipelineModel(overrideModel);
}

/**
 * Pass 1 model resolver.
 *
 * Resolution order:
 *  1) EVAL_PASS1_MODEL
 *  2) EVAL_CHUNK_MODEL
 *  3) optional overrideModel
 *  4) canonical runtime default (EVAL_OPENAI_MODEL)
 */
export function getCanonicalPass1Model(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_PASS1_MODEL", "EVAL_CHUNK_MODEL"], overrideModel);
}

/**
 * Pass 2 model resolver.
 *
 * Resolution order:
 *  1) EVAL_PASS2_MODEL
 *  2) EVAL_CHUNK_MODEL
 *  3) optional overrideModel
 *  4) canonical runtime default (EVAL_OPENAI_MODEL)
 */
export function getCanonicalPass2Model(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_PASS2_MODEL", "EVAL_CHUNK_MODEL"], overrideModel);
}

/**
 * Pass 3 model resolver.
 *
 * Resolution order:
 *  1) EVAL_PASS3_MODEL
 *  2) EVAL_SYNTHESIS_MODEL
 *  3) optional overrideModel
 *  4) canonical runtime default (EVAL_OPENAI_MODEL)
 */
export function getCanonicalPass3Model(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_PASS3_MODEL", "EVAL_SYNTHESIS_MODEL"], overrideModel);
}

/**
 * Chunk evaluation model resolver (map phase).
 *
 * Resolution order:
 *  1) EVAL_PASS1_MODEL / EVAL_PASS2_MODEL only when explicitly using pass-specific resolvers
 *  2) EVAL_CHUNK_MODEL (non-empty)
 *  3) optional overrideModel
 *  4) canonical runtime default (EVAL_OPENAI_MODEL)
 */
export function getCanonicalChunkModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_CHUNK_MODEL"], overrideModel);
}

/**
 * Synthesis model resolver (reduce phase).
 *
 * Resolution order:
 *  1) EVAL_PASS3_MODEL only when explicitly using pass-specific resolver
 *  2) EVAL_SYNTHESIS_MODEL (non-empty)
 *  3) optional overrideModel
 *  4) canonical runtime default (EVAL_OPENAI_MODEL)
 */
export function getCanonicalSynthesisModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_SYNTHESIS_MODEL"], overrideModel);
}

/**
 * Pass 3 fallback model resolver.
 *
 * Used when the primary Pass 3 route fails with a retryable or schema error and
 * the pipeline needs to route to a configured stronger model.
 *
 * Resolution order:
 *  1) EVAL_PASS3_FALLBACK_MODEL (non-empty)
 *  2) falls back to the primary Pass 3 model (EVAL_PASS3_MODEL chain)
 */
export function getCanonicalPass3FallbackModel(overrideModel?: string): string {
  const envValue = process.env.EVAL_PASS3_FALLBACK_MODEL;
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return getCanonicalPipelineModel(envValue);
  }
  // Fall back to primary pass3 model when no explicit fallback is configured.
  return getCanonicalPass3Model(overrideModel);
}

export function getExternalAdjudicationMode(): ExternalAdjudicationMode {
  return getEvaluationRuntimeConfig().adjudicationMode;
}
