/**
 * JSON Boundary Telemetry — Evidence envelope types and factory.
 *
 * Captures provider metadata, token counts, latency, and parse evidence
 * for every LLM call that goes through parseJsonObjectBoundary.
 *
 * Observability contract: passive only — must not alter control flow.
 */

import type { JsonBoundaryFailureCode } from "./jsonParseBoundary";

// ── Telemetry (LLM call metadata) ────────────────────────────────────────────

export type JsonBoundaryTelemetry = {
  provider: string;
  model: string;
  finishReason: string | undefined;
  promptTokens: number | undefined;
  completionTokens: number | undefined;
  totalTokens: number | undefined;
  latencyMs: number | undefined;
};

// ── Evidence envelope ─────────────────────────────────────────────────────────

export type JsonBoundaryEvidence = {
  rawResponseText: string;
  normalizedResponseText: string;
  extractedJsonText: string | null;
  parseFailureCode: JsonBoundaryFailureCode | null;
  parseFailureMessage: string | null;
  candidatesFound: number;
  telemetry: JsonBoundaryTelemetry | null;
};

// ── Factory ───────────────────────────────────────────────────────────────────

export type BuildJsonBoundaryEvidenceInput = {
  raw: string;
  normalized: string;
  candidate: string | null;
  candidatesFound: number;
  parseFailureCode?: JsonBoundaryFailureCode | null;
  parseFailureMessage?: string | null;
  telemetry?: JsonBoundaryTelemetry | null;
};

/**
 * Build a JsonBoundaryEvidence envelope from parse result fields.
 * Always returns a complete evidence record — never throws.
 */
export function buildJsonBoundaryEvidence(
  input: BuildJsonBoundaryEvidenceInput,
): JsonBoundaryEvidence {
  return {
    rawResponseText: input.raw,
    normalizedResponseText: input.normalized,
    extractedJsonText: input.candidate ?? null,
    parseFailureCode: input.parseFailureCode ?? null,
    parseFailureMessage: input.parseFailureMessage ?? null,
    candidatesFound: input.candidatesFound,
    telemetry: input.telemetry ?? null,
  };
}
