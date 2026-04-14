/**
 * Military-grade JSON parse boundary.
 *
 * A shared, typed, evidence-preserving JSON parse boundary module.
 * Replaces inline per-file JSON parsing across all evaluation runners.
 *
 * Non-Negotiables:
 * 1. Extract  — string-aware balanced brace extraction (survives prose, fences, multiple objects, quoted braces)
 * 2. Classify — typed failure taxonomy: EMPTY, NO_OBJECT, TRUNCATED, MALFORMED, NON_OBJECT, TOO_LARGE
 * 3. Preserve — raw + normalized + candidate + failure code on every call, success or failure
 * 4. Fail closed — JsonBoundaryError with code, raw, normalized, candidate, causeOriginal
 */

// ── Failure taxonomy ──────────────────────────────────────────────────────────

export type JsonBoundaryFailureCode =
  | "EMPTY"
  | "NO_OBJECT"
  | "TRUNCATED"
  | "MALFORMED"
  | "NON_OBJECT"
  | "TOO_LARGE";

// ── Typed error ───────────────────────────────────────────────────────────────

export class JsonBoundaryError extends Error {
  readonly code: JsonBoundaryFailureCode;
  readonly raw: string;
  readonly normalized: string;
  readonly candidate: string | null;
  readonly causeOriginal: unknown;

  constructor(params: {
    message: string;
    code: JsonBoundaryFailureCode;
    raw: string;
    normalized: string;
    candidate: string | null;
    causeOriginal?: unknown;
  }) {
    super(params.message);
    this.name = "JsonBoundaryError";
    this.code = params.code;
    this.raw = params.raw;
    this.normalized = params.normalized;
    this.candidate = params.candidate;
    this.causeOriginal = params.causeOriginal ?? null;
  }
}

// ── Result type ───────────────────────────────────────────────────────────────

export type JsonBoundaryParseResult<T> =
  | {
      ok: true;
      value: T;
      raw: string;
      normalized: string;
      candidate: string;
      candidatesFound: number;
    }
  | {
      ok: false;
      error: JsonBoundaryError;
      raw: string;
      normalized: string;
      candidate: string | null;
      candidatesFound: number;
    };

// ── Normalization helpers ─────────────────────────────────────────────────────

/** Remove UTF-8 BOM if present. */
export function stripBom(input: string): string {
  if (input.charCodeAt(0) === 0xfeff) {
    return input.slice(1);
  }
  return input;
}

/** Strip markdown code fences (```json, ```js, ```ts, plain ```). */
export function stripCodeFences(input: string): string {
  let result = input.replace(/^```(?:json|js|ts)?\s*/i, "");
  result = result.replace(/\s*```\s*$/i, "");
  return result;
}

/** Compose stripBom + stripCodeFences + trim. */
export function normalizeRaw(input: string): string {
  return stripCodeFences(stripBom(input)).trim();
}

// ── Truncation detection ──────────────────────────────────────────────────────

/**
 * Heuristic: does the normalized string look like a truncated JSON object?
 * Uses string-aware brace counting (more opens than closes) + trailing character check.
 */
export function looksPossiblyTruncated(normalized: string): boolean {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
  }

  // More opens than closes → definitely truncated
  if (depth > 0) return true;

  // If any opening braces exist but the string doesn't end with "}" → likely truncated
  const trimmed = normalized.trimEnd();
  if (
    normalized.includes("{") &&
    trimmed.length > 0 &&
    trimmed[trimmed.length - 1] !== "}"
  ) {
    return true;
  }

  return false;
}

// ── String-aware balanced brace extractor ─────────────────────────────────────

/**
 * Extract all top-level JSON objects from a string using a string-aware
 * balanced brace walker. Handles quoted braces, escape sequences, and
 * prose before/after the objects.
 *
 * Returns all complete top-level `{...}` objects found (in order).
 */
export function extractBalancedJsonObjects(input: string): string[] {
  const results: string[] = [];
  let i = 0;

  while (i < input.length) {
    if (input[i] !== "{") {
      i++;
      continue;
    }

    // Found a potential object start — walk to find its balanced end
    let depth = 0;
    let inString = false;
    let escaped = false;
    const start = i;
    let j = i;

    while (j < input.length) {
      const ch = input[j];

      if (escaped) {
        escaped = false;
        j++;
        continue;
      }
      if (ch === "\\" && inString) {
        escaped = true;
        j++;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        j++;
        continue;
      }
      if (!inString) {
        if (ch === "{") {
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0) {
            results.push(input.slice(start, j + 1));
            i = j + 1;
            break;
          }
        }
      }
      j++;
    }

    if (depth > 0) {
      // Unclosed object — skip this `{` and continue scanning
      i = start + 1;
    }
  }

  return results;
}

// ── Candidate scoring ─────────────────────────────────────────────────────────

const PREFERRED_KEYS = ["criteria", "score", "reasoning", "confidence", "overall"] as const;

// Pre-compiled patterns matching `"key":` or `"key" :` (not values containing key name)
const PREFERRED_KEY_PATTERNS: RegExp[] = PREFERRED_KEYS.map(
  (k) => new RegExp(`"${k}"\\s*:`),
);

/**
 * Choose the best candidate from a list of extracted JSON object strings.
 * Scores by presence of preferred keys (using key-colon pattern) + logarithmic string length.
 */
export function chooseBestCandidate(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  let best = candidates[0];
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    let score = 0;
    for (const pattern of PREFERRED_KEY_PATTERNS) {
      if (pattern.test(candidate)) score += 10;
    }
    score += Math.log(candidate.length + 1);

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

// ── Candidate extraction ──────────────────────────────────────────────────────

export type ExtractJsonCandidateResult = {
  raw: string;
  normalized: string;
  candidate: string | null;
  candidatesFound: number;
};

/**
 * Public: extract a JSON object candidate from raw LLM input.
 * Returns raw, normalized, candidate, and candidatesFound for evidence preservation.
 */
export function extractJsonObjectCandidate(raw: string): ExtractJsonCandidateResult {
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

// ── Failure classification ────────────────────────────────────────────────────

/**
 * Public: classify why a JSON parse attempt failed.
 * Call after extractJsonObjectCandidate and a failed JSON.parse attempt.
 */
export function classifyJsonParseFailure(params: {
  normalized: string;
  candidate: string | null;
  parseError?: unknown;
}): JsonBoundaryFailureCode {
  const { normalized, candidate, parseError } = params;

  if (normalized.trim().length === 0) return "EMPTY";

  if (candidate === null) {
    if (looksPossiblyTruncated(normalized)) return "TRUNCATED";
    return "NO_OBJECT";
  }

  if (parseError instanceof SyntaxError) {
    if (looksPossiblyTruncated(candidate)) return "TRUNCATED";
    return "MALFORMED";
  }

  if (parseError instanceof JsonBoundaryError) return parseError.code;

  return "MALFORMED";
}

// ── Human-readable descriptions for failure codes ─────────────────────────────

const FAILURE_DESCRIPTIONS: Record<JsonBoundaryFailureCode, string> = {
  EMPTY: "empty input",
  NO_OBJECT: "no JSON object found",
  TRUNCATED: "appears truncated",
  MALFORMED: "malformed JSON",
  NON_OBJECT: "parsed result is not an object",
  TOO_LARGE: "exceeds size limit",
};

// ── Main entry point ──────────────────────────────────────────────────────────

const DEFAULT_MAX_RAW_CHARS = 300_000;

/**
 * Public: parse a JSON object from raw LLM output with full evidence preservation.
 *
 * @param raw - Raw LLM response string
 * @param label - Label for error messages (e.g. "Pass1", "Pass4")
 * @param options.maxRawChars - Maximum allowed raw size in chars (default 300k)
 * @param options.validate - Optional validator callback; called with parsed value, must throw if invalid
 * @returns JsonBoundaryParseResult<T> — discriminated union ok/not-ok, always carries raw+normalized+candidate
 */
export function parseJsonObjectBoundary<T = Record<string, unknown>>(
  raw: string,
  label: string,
  options?: {
    maxRawChars?: number;
    validate?: (value: unknown) => asserts value is T;
  },
): JsonBoundaryParseResult<T> {
  const maxRawChars = options?.maxRawChars ?? DEFAULT_MAX_RAW_CHARS;
  const normalized = normalizeRaw(raw);

  // ── Size guard ───────────────────────────────────────────────────────────────
  if (raw.length > maxRawChars) {
    const err = new JsonBoundaryError({
      message:
        `[${label}] JSON_PARSE_FAILED_TOO_LARGE: Response is not valid JSON (exceeds size limit of ${maxRawChars} chars, got ${raw.length})`,
      code: "TOO_LARGE",
      raw,
      normalized,
      candidate: null,
    });
    return { ok: false, error: err, raw, normalized, candidate: null, candidatesFound: 0 };
  }

  // ── Empty guard ───────────────────────────────────────────────────────────────
  if (normalized.trim().length === 0) {
    const err = new JsonBoundaryError({
      message: `[${label}] JSON_PARSE_FAILED_EMPTY: Response is not valid JSON (empty input)`,
      code: "EMPTY",
      raw,
      normalized,
      candidate: null,
    });
    return { ok: false, error: err, raw, normalized, candidate: null, candidatesFound: 0 };
  }

  // ── Extract candidates ────────────────────────────────────────────────────────
  const candidates = extractBalancedJsonObjects(normalized);
  const candidate = chooseBestCandidate(candidates);

  if (candidate === null) {
    const code: JsonBoundaryFailureCode = looksPossiblyTruncated(normalized)
      ? "TRUNCATED"
      : "NO_OBJECT";
    const err = new JsonBoundaryError({
      message: `[${label}] JSON_PARSE_FAILED_${code}: Response is not valid JSON (${FAILURE_DESCRIPTIONS[code]})`,
      code,
      raw,
      normalized,
      candidate: null,
    });
    return { ok: false, error: err, raw, normalized, candidate: null, candidatesFound: candidates.length };
  }

  // ── Parse ─────────────────────────────────────────────────────────────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (parseError) {
    const code = classifyJsonParseFailure({ normalized, candidate, parseError });
    const err = new JsonBoundaryError({
      message: `[${label}] JSON_PARSE_FAILED_${code}: Response is not valid JSON (${FAILURE_DESCRIPTIONS[code]})`,
      code,
      raw,
      normalized,
      candidate,
      causeOriginal: parseError,
    });
    return { ok: false, error: err, raw, normalized, candidate, candidatesFound: candidates.length };
  }

  // ── Non-object guard ──────────────────────────────────────────────────────────
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    const err = new JsonBoundaryError({
      message: `[${label}] JSON_PARSE_FAILED_NON_OBJECT: Response is not valid JSON (${FAILURE_DESCRIPTIONS["NON_OBJECT"]})`,
      code: "NON_OBJECT",
      raw,
      normalized,
      candidate,
    });
    return { ok: false, error: err, raw, normalized, candidate, candidatesFound: candidates.length };
  }

  // ── Optional schema validation ────────────────────────────────────────────────
  if (options?.validate) {
    try {
      options.validate(parsed);
    } catch (validateError) {
      const code: JsonBoundaryFailureCode =
        validateError instanceof JsonBoundaryError ? validateError.code : "MALFORMED";
      const detail =
        validateError instanceof Error ? validateError.message : String(validateError);
      const err = new JsonBoundaryError({
        message: `[${label}] JSON_PARSE_FAILED_${code}: Response is not valid JSON (schema validation failed: ${detail})`,
        code,
        raw,
        normalized,
        candidate,
        causeOriginal: validateError,
      });
      return { ok: false, error: err, raw, normalized, candidate, candidatesFound: candidates.length };
    }
  }

  return {
    ok: true,
    value: parsed as T,
    raw,
    normalized,
    candidate,
    candidatesFound: candidates.length,
  };
}
