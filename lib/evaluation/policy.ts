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

export function buildOpenAIOutputTokenParam(
  model: string,
  maxOutputTokens: number,
): OpenAIOutputTokenParam {
  return isReasoningStyleModel(model)
    ? { max_completion_tokens: maxOutputTokens }
    : { max_tokens: maxOutputTokens };
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

export function getExternalAdjudicationMode(): ExternalAdjudicationMode {
  return getEvaluationRuntimeConfig().adjudicationMode;
}
