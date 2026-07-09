export type OpenAIOutputTokenParam = {
  max_tokens?: number;
  max_completion_tokens?: number;
};

/**
 * Centralized OpenAI SDK transport retry ceiling.
 * Tier 4: raised from 2 → 3. Higher rate limits reduce risk of retry storms,
 * and extra retries recover transient 429s / 500s / 502s that previously
 * caused unnecessary chunk failures. The SDK uses exponential backoff.
 */
export const OPENAI_SDK_MAX_RETRIES = 3;

export type OpenAITemperatureParam = {
  temperature?: number;
};

export type ExternalAdjudicationMode = "optional" | "required" | "veto";

import { getEvaluationRuntimeConfig } from "@/lib/config/evaluationRuntimeConfig";

const GPT55_ALLOWED_ESCALATION_REASONS = new Set([
  "premium_tier",
  "quality_gate_failure",
  "contradiction_detected",
  "appeal",
  "manual_override",
  "black_label",
]);

function resolveEscalationReason(): string | null {
  const raw = process.env.EVAL_ESCALATION_REASON;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

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
 * Unknown models intentionally pass through unclamped — better to surface a
 * provider-side 400 than to silently truncate when the real cap is unknown.
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
  "gpt-5": 32768,
  "gpt-5-nano": 16384,
  "gpt-5-mini": 16384,
  "gpt-5.1": 128000,
  "gpt-5.1-chat-latest": 128000,
  "gpt-5.1-codex-max": 128000,
  "gpt-5.4-nano": 16384,
  "gpt-5.4-mini": 16384,
  "gpt-5.4": 32768,
  "gpt-5.5": 32768,
  "gpt-4.1": 32768,
  "gpt-4.1-mini": 32768,
  "gpt-4.1-nano": 32768,
});

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
    throw new Error(`[Config] reasoning model '${candidate}' not permitted in production`);
  }

  if (process.env.NODE_ENV === "production" && normalizedCandidate.startsWith("gpt-5.5")) {
    const escalationReason = resolveEscalationReason();
    if (!escalationReason || !GPT55_ALLOWED_ESCALATION_REASONS.has(escalationReason)) {
      throw new Error(
        `[Config] model '${candidate}' requires EVAL_ESCALATION_REASON ∈ {${Array.from(GPT55_ALLOWED_ESCALATION_REASONS).join(", ")}} in production`,
      );
    }
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

export function getCanonicalPass1Model(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_PASS1_MODEL", "EVAL_CHUNK_MODEL", "EVAL_CHEAP_MODEL"], overrideModel);
}

export function getCanonicalPass2Model(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_PASS2_MODEL", "EVAL_CHUNK_MODEL", "EVAL_CHEAP_MODEL"], overrideModel);
}

export function getCanonicalPass3Model(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_PASS3_MODEL", "EVAL_SYNTHESIS_MODEL"], overrideModel);
}

export function getCanonicalChunkModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_CHUNK_MODEL", "EVAL_CHEAP_MODEL"], overrideModel);
}

export function getCanonicalSynthesisModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_SYNTHESIS_MODEL"], overrideModel);
}

export function getCanonicalPass3FallbackModel(overrideModel?: string): string {
  const envValue = process.env.EVAL_PASS3_FALLBACK_MODEL;
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return getCanonicalPipelineModel(envValue);
  }
  return getCanonicalPass3Model(overrideModel);
}

export function getCanonicalSeedModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_SEED_MODEL", "EVAL_SYNTHESIS_MODEL"], overrideModel);
}

export function getCanonicalLedgerModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_LEDGER_MODEL", "EVAL_SYNTHESIS_MODEL"], overrideModel);
}

export function getCanonicalLongContextLedgerModel(): string {
  const envValue = process.env.EVAL_LONG_CONTEXT_MODEL;
  if (typeof envValue === "string" && envValue.trim().length > 0) {
    return envValue.trim();
  }
  return "gpt-4.1-mini";
}

export const LONG_CONTEXT_TOKEN_THRESHOLD = 120_000;

export function getCanonicalPolishModel(overrideModel?: string): string {
  return resolveEnvBackedModel(["EVAL_POLISH_MODEL", "EVAL_CHEAP_MODEL"], overrideModel);
}

export function getExternalAdjudicationMode(): ExternalAdjudicationMode {
  return getEvaluationRuntimeConfig().adjudicationMode;
}

// ─────────────────────────────────────────────────────────────────────────────
// ECG_MODE — Artifact Certification Authority rollout control
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ECG enforcement level.
 *
 *   OFF        — Emergency rollback only. Gate is skipped and artifacts pass through.
 *   WARN_ONLY  — Rollback/measurement override. Gate runs, logs, and surfaces warnings,
 *                but does not block persistence.
 *   ENFORCE    — Default production posture. FATAL violations block persistence.
 */
export type ECGMode = "OFF" | "WARN_ONLY" | "ENFORCE";

export const ECG_DEFAULT_MODE: ECGMode = "ENFORCE";

/**
 * Read ECG_MODE from environment.
 *
 * #1222 rollout policy:
 * - unset / empty ECG_MODE defaults to ENFORCE;
 * - invalid ECG_MODE defaults to ENFORCE rather than silently weakening safety;
 * - explicit WARN_ONLY and OFF remain available as rollback/incident overrides.
 */
export function getECGMode(): ECGMode {
  const raw = process.env.ECG_MODE;
  const normalized = typeof raw === "string" ? raw.trim().toUpperCase() : "";

  if (normalized === "OFF" || normalized === "WARN_ONLY" || normalized === "ENFORCE") {
    return normalized as ECGMode;
  }

  if (normalized.length > 0) {
    console.warn(`[policy] Unknown ECG_MODE="${normalized}", falling back to ${ECG_DEFAULT_MODE}`);
  }

  return ECG_DEFAULT_MODE;
}
