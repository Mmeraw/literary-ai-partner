/* eslint-disable no-control-regex */

export type JsonBoundaryFailureCode =
  | "JSON_PARSE_FAILED_EMPTY"
  | "JSON_PARSE_FAILED_NO_OBJECT"
  | "JSON_PARSE_FAILED_TRUNCATED"
  | "JSON_PARSE_FAILED_MALFORMED"
  | "JSON_PARSE_FAILED_NON_OBJECT"
  | "JSON_PARSE_FAILED_TOO_LARGE";

export class JsonBoundaryError extends Error {
  public readonly code: JsonBoundaryFailureCode;
  public readonly raw: string;
  public readonly normalized: string;
  public readonly candidate?: string;
  public readonly candidatesFound?: number;
  public readonly causeOriginal?: unknown;

  constructor(args: {
    code: JsonBoundaryFailureCode;
    message: string;
    raw: string;
    normalized: string;
    candidate?: string;
    candidatesFound?: number;
    causeOriginal?: unknown;
  }) {
    super(args.message);
    this.name = "JsonBoundaryError";
    this.code = args.code;
    this.raw = args.raw;
    this.normalized = args.normalized;
    this.candidate = args.candidate;
    this.candidatesFound = args.candidatesFound;
    this.causeOriginal = args.causeOriginal;
  }
}

export type JsonBoundaryParseResult<T> = {
  ok: true;
  value: T;
  raw: string;
  normalized: string;
  candidate: string;
  candidatesFound: number;
};

const DEFAULT_MAX_RAW_CHARS = 300_000;

function stripBom(input: string): string {
  return input.replace(/^\uFEFF/, "");
}

function stripCodeFences(input: string): string {
  const trimmed = input.trim();
  const fenced = trimmed.match(/^```(?:json|javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return input;
}

function normalizeRaw(input: string): string {
  return stripCodeFences(stripBom(input)).trim();
}

function looksPossiblyTruncated(input: string): boolean {
  const s = input.trim();
  if (!s) return false;

  const openCurly = (s.match(/\{/g) ?? []).length;
  const closeCurly = (s.match(/\}/g) ?? []).length;
  const openSquare = (s.match(/\[/g) ?? []).length;
  const closeSquare = (s.match(/]/g) ?? []).length;

  if (openCurly > closeCurly || openSquare > closeSquare) {
    return true;
  }

  if (/[{\[,:\-]$/.test(s)) {
    return true;
  }

  return false;
}

function extractBalancedJsonObjects(input: string): string[] {
  const results: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        start = i;
      }
      depth += 1;
      continue;
    }

    if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        results.push(input.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return results;
}

function chooseBestCandidate(candidates: string[]): string | undefined {
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) return candidates[0];

  const ranked = candidates.map((candidate) => {
    let score = 0;
    if (/"criteria"\s*:/.test(candidate)) score += 50;
    if (/"overall"\s*:/.test(candidate)) score += 25;
    if (/"metadata"\s*:/.test(candidate)) score += 15;
    if (/"synthesisNote"\s*:/.test(candidate)) score += 15;
    score += Math.min(candidate.length / 100, 25);
    return { candidate, score };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.candidate;
}

export function extractJsonObjectCandidate(raw: string): {
  raw: string;
  normalized: string;
  candidate?: string;
  candidatesFound: number;
} {
  const normalized = normalizeRaw(raw);
  const candidates = extractBalancedJsonObjects(normalized);
  const candidate = chooseBestCandidate(candidates);

  return {
    raw,
    normalized,
    candidate,
    candidatesFound: candidates.length,
  };
}

export function classifyJsonParseFailure(
  raw: string,
  normalized: string,
  candidate?: string,
): JsonBoundaryFailureCode {
  if (!raw.trim()) return "JSON_PARSE_FAILED_EMPTY";
  if (raw.length > DEFAULT_MAX_RAW_CHARS) return "JSON_PARSE_FAILED_TOO_LARGE";
  if (!normalized.trim()) return "JSON_PARSE_FAILED_EMPTY";

  if (!candidate) {
    return looksPossiblyTruncated(normalized)
      ? "JSON_PARSE_FAILED_TRUNCATED"
      : "JSON_PARSE_FAILED_NO_OBJECT";
  }

  if (looksPossiblyTruncated(candidate)) {
    return "JSON_PARSE_FAILED_TRUNCATED";
  }

  return "JSON_PARSE_FAILED_MALFORMED";
}

export function parseJsonObjectBoundary<T extends Record<string, unknown>>(
  raw: string,
  options?: {
    label?: string;
    maxRawChars?: number;
    validate?: (value: unknown) => value is T;
  },
): JsonBoundaryParseResult<T> {
  const label = options?.label ?? "JSON";
  const maxRawChars = options?.maxRawChars ?? DEFAULT_MAX_RAW_CHARS;

  if (raw.length > maxRawChars) {
    throw new JsonBoundaryError({
      code: "JSON_PARSE_FAILED_TOO_LARGE",
      message: `${label} payload exceeds max size (${maxRawChars} chars)`,
      raw,
      normalized: "",
    });
  }

  const extracted = extractJsonObjectCandidate(raw);

  if (!extracted.candidate) {
    const code = classifyJsonParseFailure(raw, extracted.normalized);
    throw new JsonBoundaryError({
      code,
      message: `${label} extraction failed: ${code}`,
      raw,
      normalized: extracted.normalized,
      candidatesFound: extracted.candidatesFound,
    });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted.candidate);
  } catch (error) {
    const code = classifyJsonParseFailure(raw, extracted.normalized, extracted.candidate);
    throw new JsonBoundaryError({
      code,
      message: `${label} parse failed: ${code}`,
      raw,
      normalized: extracted.normalized,
      candidate: extracted.candidate,
      candidatesFound: extracted.candidatesFound,
      causeOriginal: error,
    });
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new JsonBoundaryError({
      code: "JSON_PARSE_FAILED_NON_OBJECT",
      message: `${label} parsed but did not produce a JSON object`,
      raw,
      normalized: extracted.normalized,
      candidate: extracted.candidate,
      candidatesFound: extracted.candidatesFound,
    });
  }

  if (options?.validate && !options.validate(parsed)) {
    throw new JsonBoundaryError({
      code: "JSON_PARSE_FAILED_MALFORMED",
      message: `${label} parsed but failed schema/type validation`,
      raw,
      normalized: extracted.normalized,
      candidate: extracted.candidate,
      candidatesFound: extracted.candidatesFound,
    });
  }

  return {
    ok: true,
    value: parsed as T,
    raw,
    normalized: extracted.normalized,
    candidate: extracted.candidate,
    candidatesFound: extracted.candidatesFound,
  };
}
