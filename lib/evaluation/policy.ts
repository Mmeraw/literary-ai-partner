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

export function getCanonicalPipelineModel(overrideModel?: string): string {
  const candidate = (overrideModel || "").trim();
  return candidate.length > 0 ? candidate : getEvaluationRuntimeConfig().model;
}

export function getExternalAdjudicationMode(): ExternalAdjudicationMode {
  return getEvaluationRuntimeConfig().adjudicationMode;
}

export const OPENAI_SDK_MAX_RETRIES = 1;
