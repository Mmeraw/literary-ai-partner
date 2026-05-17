import type { PassCompletionCapture, PipelineProviderTelemetryEntry } from "./types";

export type ProviderTelemetryEntry = PipelineProviderTelemetryEntry;

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
    pass: params.capture.pass,
    provider: params.provider ?? "openai",
    model: params.capture.model,
    request_id: params.capture.request_id,
    finish_reason: params.capture.finish_reason,
    usage: params.capture.usage,
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
