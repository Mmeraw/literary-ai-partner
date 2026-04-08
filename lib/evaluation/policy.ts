export type OpenAIOutputTokenParam = {
  max_tokens?: number;
  max_completion_tokens?: number;
};

export type OpenAITemperatureParam = {
  temperature?: number;
};

export type ExternalAdjudicationMode = "optional" | "required" | "veto";

const DEFAULT_PIPELINE_MODEL = (process.env.EVAL_OPENAI_MODEL || "o3").trim() || "o3";

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
  return candidate.length > 0 ? candidate : DEFAULT_PIPELINE_MODEL;
}

export function getExternalAdjudicationMode(): ExternalAdjudicationMode {
  const raw = (process.env.EVAL_EXTERNAL_ADJUDICATION_MODE || "optional").trim().toLowerCase();

  if (raw === "required" || raw === "veto") {
    return raw;
  }

  return "optional";
}
