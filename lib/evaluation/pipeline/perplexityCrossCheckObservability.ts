/**
 * Pass 4 structured observability helpers.
 *
 * Extracted from perplexityCrossCheck.ts to keep that file under 1000 lines
 * after the structured logging plumb-through. These helpers emit single-line
 * JSON log lines prefixed with `[Pass4]` so future postmortems can
 * `grep "[Pass4]" | jq` Vercel logs by job_id.
 *
 * No behavior change — observability only.
 */

import { JsonBoundaryError } from "./jsonParseBoundary";

export type Pass4ShapeVariant =
  | "canonical"
  | "analysisMetadata_wrapper"
  | "criteria_array"
  | "unknown";

export type Pass4ParseOutcome =
  | "ok"
  | "json_parse_failed"
  | "schema_invalid"
  | "canon_invalid"
  | "truncated_json"
  | "refusal";

export type Pass4FinalStatus =
  | "success"
  | "refusal_exhausted"
  | "canon_invalid"
  | "http_error"
  | "timeout"
  | "shape_unrecognized"
  | "schema_invalid";

export function emitPass4Log(
  level: "log" | "warn" | "error",
  payload: Record<string, unknown>,
): void {
  let serialized: string;
  try {
    serialized = JSON.stringify(payload);
  } catch {
    serialized = JSON.stringify({ event: "pass4_log_serialize_failed" });
  }
  // eslint-disable-next-line no-console
  console[level](`[Pass4] ${serialized}`);
}

export function detectShapeVariant(parsed: unknown): Pass4ShapeVariant {
  if (!parsed || typeof parsed !== "object") return "unknown";
  const obj = parsed as Record<string, unknown>;
  if (
    obj.analysisMetadata &&
    typeof obj.analysisMetadata === "object" &&
    (obj.criteria === undefined || obj.criteria === null)
  ) {
    return "analysisMetadata_wrapper";
  }
  if (Array.isArray(obj.criteria)) return "criteria_array";
  if (obj.criteria && typeof obj.criteria === "object") return "canonical";
  return "unknown";
}

export function summarizeCriteriaKeys(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const obj = parsed as Record<string, unknown>;
  const c = obj.criteria;
  if (Array.isArray(c)) {
    return c
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const entry = item as Record<string, unknown>;
        return (
          (typeof entry.key === "string" && entry.key) ||
          (typeof entry.name === "string" && entry.name) ||
          (typeof entry.criterion === "string" && entry.criterion) ||
          null
        );
      })
      .filter((k): k is string => typeof k === "string" && k.trim().length > 0);
  }
  if (c && typeof c === "object") {
    return Object.keys(c as Record<string, unknown>);
  }
  return [];
}

export function classifyParseError(error: unknown): {
  outcome: Pass4ParseOutcome;
  finalStatus: Pass4FinalStatus;
  errorCode: string;
} {
  if (error instanceof JsonBoundaryError) {
    const truncated = error.code === "JSON_PARSE_FAILED_TRUNCATED";
    return {
      outcome: truncated ? "truncated_json" : "json_parse_failed",
      finalStatus: "schema_invalid",
      errorCode: `PASS4_${error.code}`,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/Criterion '.+' (missing|missing valid|missing rationale)/i.test(message)) {
    return {
      outcome: "canon_invalid",
      finalStatus: "canon_invalid",
      errorCode: "PASS4_CANON_INVALID",
    };
  }
  if (/missing 'criteria'|not an object/i.test(message)) {
    return {
      outcome: "schema_invalid",
      finalStatus: "schema_invalid",
      errorCode: "PASS4_SCHEMA_INVALID",
    };
  }
  return {
    outcome: "schema_invalid",
    finalStatus: "schema_invalid",
    errorCode: "PASS4_SCHEMA_INVALID",
  };
}
