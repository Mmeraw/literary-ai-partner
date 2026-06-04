import type { PassCompletionCapture, PipelineProviderTelemetryEntry } from "./types";

export type ProviderTelemetryEntry = PipelineProviderTelemetryEntry;

const MODEL_PRICING_USD_PER_1K: Record<string, { input: number; output: number }> = {
  "gpt-5.1": { input: 0.00125, output: 0.01 },
  "gpt-5": { input: 0.00125, output: 0.01 },
  "gpt-5-mini": { input: 0.00025, output: 0.002 },
  "gpt-5-nano": { input: 0.00005, output: 0.0004 },
  "gpt-5.4": { input: 0.0025, output: 0.015 },
  "gpt-5.5": { input: 0.005, output: 0.03 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "o3": { input: 0.002, output: 0.008 },
  "o3-mini": { input: 0.0011, output: 0.0044 },
};

function mapPassToPhase(pass: 1 | 2 | 3): "pass1" | "pass2" | "pass3" {
  if (pass === 1) return "pass1";
  if (pass === 2) return "pass2";
  return "pass3";
}

function estimateCostUsd(model: string, usage?: PassCompletionCapture["usage"]): number | undefined {
  if (!usage) return undefined;

  const promptTokens = typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : undefined;
  const completionTokens = typeof usage.completion_tokens === "number" ? usage.completion_tokens : undefined;

  if (promptTokens === undefined && completionTokens === undefined) return undefined;

  const pricing = MODEL_PRICING_USD_PER_1K[model] ?? MODEL_PRICING_USD_PER_1K["gpt-5.1"];
  const inputUsd = ((promptTokens ?? 0) / 1000) * pricing.input;
  const outputUsd = ((completionTokens ?? 0) / 1000) * pricing.output;
  return Number((inputUsd + outputUsd).toFixed(8));
}

export function recordProviderTelemetry(params: {
  capture: PassCompletionCapture;
  jobId?: string;
  provider?: "openai" | "perplexity";
  startedAt: string;
}): ProviderTelemetryEntry {
  const completedAt = params.capture.generated_at;
  const startedMs = Date.parse(params.startedAt);
  const completedMs = Date.parse(completedAt);
  const durationMs =
    Number.isFinite(startedMs) && Number.isFinite(completedMs)
      ? Math.max(0, completedMs - startedMs)
      : 0;

  return {
    job_id: params.jobId ?? "unknown",
    phase: mapPassToPhase(params.capture.pass),
    pass: params.capture.pass,
    provider: params.provider ?? "openai",
    model: params.capture.model,
    request_id: params.capture.request_id,
    finish_reason: params.capture.finish_reason,
    usage: params.capture.usage,
    cached_input_tokens: null,
    retry_attempt: 0,
    estimated_cost_usd: estimateCostUsd(params.capture.model, params.capture.usage),
    called_at: completedAt,
    started_at: params.startedAt,
    completed_at: completedAt,
    duration_ms: durationMs,
    success: true,
  };
}

export function mergeProviderTelemetry(
  existing: ProviderTelemetryEntry[] = [],
  next: ProviderTelemetryEntry
): ProviderTelemetryEntry[] {
  return [...existing, next];
}
