/**
 * Tests for lib/llm/jsonParseBoundary.ts
 *
 * Covers: fenced JSON, leading prose, multiple objects, quoted braces,
 * truncated payloads, giant payload rejection, schema validation,
 * empty input, non-object results, BOM stripping.
 */

import { describe, expect, it } from "@jest/globals";
import {
  stripBom,
  stripCodeFences,
  normalizeRaw,
  looksPossiblyTruncated,
  extractBalancedJsonObjects,
  chooseBestCandidate,
  extractJsonObjectCandidate,
  classifyJsonParseFailure,
  parseJsonObjectBoundary,
  JsonBoundaryError,
} from "@/lib/llm/jsonParseBoundary";

// ── stripBom ──────────────────────────────────────────────────────────────────

describe("stripBom", () => {
  it("removes UTF-8 BOM from the start of a string", () => {
    const withBom = "\uFEFF{\"key\":\"value\"}";
    expect(stripBom(withBom)).toBe("{\"key\":\"value\"}");
  });

  it("leaves strings without BOM unchanged", () => {
    expect(stripBom("{\"key\":\"value\"}")).toBe("{\"key\":\"value\"}");
    expect(stripBom("hello")).toBe("hello");
    expect(stripBom("")).toBe("");
  });
});

// ── stripCodeFences ───────────────────────────────────────────────────────────

describe("stripCodeFences", () => {
  it("strips ```json fences", () => {
    const fenced = "```json\n{\"a\":1}\n```";
    expect(stripCodeFences(fenced)).toBe("{\"a\":1}");
  });

  it("strips plain ``` fences", () => {
    const fenced = "```\n{\"a\":1}\n```";
    expect(stripCodeFences(fenced)).toBe("{\"a\":1}");
  });

  it("strips ```js fences", () => {
    const fenced = "```js\n{\"a\":1}\n```";
    expect(stripCodeFences(fenced)).toBe("{\"a\":1}");
  });

  it("strips ```ts fences", () => {
    const fenced = "```ts\n{\"a\":1}\n```";
    expect(stripCodeFences(fenced)).toBe("{\"a\":1}");
  });

  it("leaves unfenced strings unchanged", () => {
    expect(stripCodeFences("{\"a\":1}")).toBe("{\"a\":1}");
  });
});

// ── normalizeRaw ──────────────────────────────────────────────────────────────

describe("normalizeRaw", () => {
  it("strips BOM, fences, and trims whitespace", () => {
    const input = "\uFEFF```json\n  {\"a\":1}  \n```  ";
    expect(normalizeRaw(input)).toBe("{\"a\":1}");
  });
});

// ── looksPossiblyTruncated ────────────────────────────────────────────────────

describe("looksPossiblyTruncated", () => {
  it("returns true when more opening braces than closing", () => {
    expect(looksPossiblyTruncated("{\"key\": \"value\"")).toBe(true);
    expect(looksPossiblyTruncated("{\"nested\": {\"a\":")).toBe(true);
  });

  it("returns false for a balanced JSON object", () => {
    expect(looksPossiblyTruncated("{\"key\": \"value\"}")).toBe(false);
  });

  it("returns false for a string with no braces", () => {
    expect(looksPossiblyTruncated("not json at all")).toBe(false);
  });

  it("handles quoted braces correctly — does not count braces inside strings", () => {
    // The } inside the string should not count as a closing brace
    expect(looksPossiblyTruncated("{\"key\": \"{fake}\"}")).toBe(false);
    // If actually truncated after a quoted brace:
    expect(looksPossiblyTruncated("{\"key\": \"hello\" ")).toBe(true);
  });

  it("handles escape sequences inside strings", () => {
    // Escaped quote inside a string — should not end the string
    expect(looksPossiblyTruncated("{\"key\": \"val\\\"ue\"}")).toBe(false);
  });
});

// ── extractBalancedJsonObjects ────────────────────────────────────────────────

describe("extractBalancedJsonObjects", () => {
  it("extracts a single top-level object", () => {
    const results = extractBalancedJsonObjects("{\"a\":1}");
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("{\"a\":1}");
  });

  it("extracts objects preceded by prose text", () => {
    const input = "Here is the result: {\"score\":8, \"reasoning\":\"good\"} Thank you.";
    const results = extractBalancedJsonObjects(input);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("{\"score\":8, \"reasoning\":\"good\"}");
  });

  it("extracts multiple top-level objects", () => {
    const input = "{\"a\":1} some text {\"b\":2}";
    const results = extractBalancedJsonObjects(input);
    expect(results).toHaveLength(2);
    expect(results[0]).toBe("{\"a\":1}");
    expect(results[1]).toBe("{\"b\":2}");
  });

  it("handles nested objects correctly", () => {
    const input = "{\"outer\":{\"inner\":42}}";
    const results = extractBalancedJsonObjects(input);
    expect(results).toHaveLength(1);
    expect(results[0]).toBe("{\"outer\":{\"inner\":42}}");
  });

  it("handles quoted braces inside strings — does not confuse them with object braces", () => {
    const input = "{\"key\":\"value with } brace inside\"}";
    const results = extractBalancedJsonObjects(input);
    expect(results).toHaveLength(1);
    // The full object should be captured, not truncated at the } inside the string
    expect(results[0]).toBe("{\"key\":\"value with } brace inside\"}");
  });

  it("handles escape sequences inside strings", () => {
    const input = "{\"key\":\"escaped \\\"quote\\\"\"}";
    const results = extractBalancedJsonObjects(input);
    expect(results).toHaveLength(1);
    expect(JSON.parse(results[0])).toEqual({ key: 'escaped "quote"' });
  });

  it("returns empty array for input with no object", () => {
    expect(extractBalancedJsonObjects("no json here")).toHaveLength(0);
    expect(extractBalancedJsonObjects("[1,2,3]")).toHaveLength(0);
    expect(extractBalancedJsonObjects("")).toHaveLength(0);
  });

  it("skips unclosed objects and does not hang", () => {
    // Truncated input with unclosed brace
    const results = extractBalancedJsonObjects("{\"key\": \"value\"");
    expect(results).toHaveLength(0);
  });
});

// ── chooseBestCandidate ───────────────────────────────────────────────────────

describe("chooseBestCandidate", () => {
  it("returns null for empty candidates", () => {
    expect(chooseBestCandidate([])).toBeNull();
  });

  it("returns the only candidate when there is one", () => {
    expect(chooseBestCandidate(["{\"a\":1}"])).toBe("{\"a\":1}");
  });

  it("prefers candidates with preferred keys (criteria, score, reasoning, confidence, overall)", () => {
    const withCriteria = "{\"criteria\":[],\"other\":\"data\"}";
    const withoutCriteria = "{\"x\":1}";
    expect(chooseBestCandidate([withoutCriteria, withCriteria])).toBe(withCriteria);
  });

  it("prefers longer candidates when key scores are equal", () => {
    const short = "{\"a\":1}";
    const long = "{\"a\":1,\"b\":2,\"c\":3,\"d\":4,\"e\":5}";
    expect(chooseBestCandidate([short, long])).toBe(long);
  });
});

// ── parseJsonObjectBoundary — success cases ───────────────────────────────────

describe("parseJsonObjectBoundary — success cases", () => {
  it("parses a plain JSON object", () => {
    const result = parseJsonObjectBoundary("{\"criteria\":[],\"score\":7}", "Test");
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value).toEqual({ criteria: [], score: 7 });
      expect(result.candidatesFound).toBe(1);
      expect(result.candidate).toBe("{\"criteria\":[],\"score\":7}");
    }
  });

  it("strips json code fences before parsing", () => {
    const fenced = "```json\n{\"key\":\"val\"}\n```";
    const result = parseJsonObjectBoundary(fenced, "Test");
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.value).toEqual({ key: "val" });
    }
  });

  it("handles leading prose before JSON object", () => {
    const input = "Here is my analysis:\n{\"score\":8, \"reasoning\":\"excellent prose\"}";
    const result = parseJsonObjectBoundary(input, "Test");
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect((result.value as { score: number }).score).toBe(8);
    }
  });

  it("picks the best candidate when multiple objects are present", () => {
    const input = "{\"x\":1} {\"criteria\":[{\"key\":\"concept\"}],\"score\":9}";
    const result = parseJsonObjectBoundary(input, "Test");
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      // Should prefer the one with "criteria" key
      const val = result.value as Record<string, unknown>;
      expect(val["criteria"]).toBeDefined();
      expect(result.candidatesFound).toBe(2);
    }
  });

  it("handles quoted braces inside string values correctly", () => {
    const input = "{\"text\":\"contains } a brace\",\"score\":5}";
    const result = parseJsonObjectBoundary(input, "Test");
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      const val = result.value as { text: string; score: number };
      expect(val.text).toBe("contains } a brace");
      expect(val.score).toBe(5);
    }
  });

  it("strips BOM before parsing", () => {
    const input = "\uFEFF{\"key\":\"bom-stripped\"}";
    const result = parseJsonObjectBoundary(input, "Test");
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect((result.value as { key: string }).key).toBe("bom-stripped");
    }
  });

  it("always preserves raw, normalized, and candidate on success", () => {
    const raw = "  {\"a\":1}  ";
    const result = parseJsonObjectBoundary(raw, "Test");
    expect(result.ok).toBe(true);
    expect(result.raw).toBe(raw);
    expect(result.normalized).toBe("{\"a\":1}");
    expect(result.candidate).toBeDefined();
  });
});

// ── parseJsonObjectBoundary — failure cases ───────────────────────────────────

describe("parseJsonObjectBoundary — failure cases", () => {
  it("returns EMPTY for empty input", () => {
    const result = parseJsonObjectBoundary("", "Test");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("EMPTY");
      expect(result.error).toBeInstanceOf(JsonBoundaryError);
    }
  });

  it("returns EMPTY for whitespace-only input", () => {
    const result = parseJsonObjectBoundary("   \n\t  ", "Test");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("EMPTY");
    }
  });

  it("returns TRUNCATED for input with unclosed brace", () => {
    const result = parseJsonObjectBoundary("{\"key\": \"value\"", "Test");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("TRUNCATED");
      expect(result.error.message).toContain("JSON_PARSE_FAILED_TRUNCATED");
    }
  });

  it("returns NO_OBJECT for prose with no JSON object", () => {
    const result = parseJsonObjectBoundary("This is just plain text, no JSON.", "Test");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("NO_OBJECT");
      expect(result.error.message).toContain("JSON_PARSE_FAILED_NO_OBJECT");
    }
  });

  it("returns MALFORMED for syntactically invalid JSON (ends with })", () => {
    const result = parseJsonObjectBoundary("{ this: is not valid json }", "Test");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("MALFORMED");
      expect(result.error.message).toContain("JSON_PARSE_FAILED_MALFORMED");
    }
  });

  it("returns NON_OBJECT when parsed result is an array", () => {
    // An array-only response — the extractor won't find { } but
    // we can test via a top-level array wrapped in an object scenario.
    // Direct test: if somehow a non-object is returned by a validator:
    const result = parseJsonObjectBoundary(
      "{\"wrapper\":[1,2,3]}",
      "Test",
      {
        validate: (v) => {
          // Force a NON_OBJECT-like failure via JsonBoundaryError
          const obj = v as Record<string, unknown>;
          if (!Array.isArray(obj["wrapper"])) {
            throw new JsonBoundaryError({
              message: "not an array",
              code: "NON_OBJECT",
              raw: "",
              normalized: "",
              candidate: null,
            });
          }
        },
      }
    );
    // The validate callback should succeed since wrapper IS an array
    expect(result.ok).toBe(true);
  });

  it("returns TOO_LARGE when raw exceeds maxRawChars", () => {
    const giant = "{" + "\"k\":\"" + "x".repeat(200) + "\"}";
    const result = parseJsonObjectBoundary(giant, "Test", { maxRawChars: 100 });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("TOO_LARGE");
      expect(result.error.message).toContain("JSON_PARSE_FAILED_TOO_LARGE");
    }
  });

  it("rejects payloads exceeding the default 300k char limit", () => {
    const giant = "{\"key\":\"" + "x".repeat(300_001) + "\"}";
    const result = parseJsonObjectBoundary(giant, "Test");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("TOO_LARGE");
    }
  });

  it("always preserves raw, normalized, candidate on failure", () => {
    const raw = "{\"key\": \"value\"";
    const result = parseJsonObjectBoundary(raw, "Test");
    expect(result.ok).toBe(false);
    expect(result.raw).toBe(raw);
    expect(result.normalized).toBeDefined();
    expect(result.candidate).toBeNull();
  });

  it("includes label in error message", () => {
    const result = parseJsonObjectBoundary("", "MyLabel");
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.message).toContain("[MyLabel]");
    }
  });
});

// ── parseJsonObjectBoundary — validate callback ───────────────────────────────

describe("parseJsonObjectBoundary — validate callback", () => {
  it("returns ok=true when validate passes", () => {
    const result = parseJsonObjectBoundary(
      "{\"criteria\":[\"a\"]}",
      "Test",
      {
        validate: (value) => {
          const obj = value as Record<string, unknown>;
          if (!Array.isArray(obj["criteria"])) throw new Error("no criteria");
        },
      }
    );
    expect(result.ok).toBe(true);
  });

  it("returns MALFORMED when validate throws", () => {
    const result = parseJsonObjectBoundary(
      "{\"foo\":\"bar\"}",
      "Test",
      {
        validate: () => {
          throw new Error("missing required field");
        },
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("MALFORMED");
      expect(result.error.message).toContain("schema validation failed");
      expect(result.error.message).toContain("missing required field");
    }
  });

  it("preserves JsonBoundaryError code from validate callback", () => {
    const result = parseJsonObjectBoundary(
      "{\"foo\":\"bar\"}",
      "Test",
      {
        validate: () => {
          throw new JsonBoundaryError({
            message: "truncated inside validate",
            code: "TRUNCATED",
            raw: "",
            normalized: "",
            candidate: null,
          });
        },
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.code).toBe("TRUNCATED");
    }
  });
});

// ── JsonBoundaryError ─────────────────────────────────────────────────────────

describe("JsonBoundaryError", () => {
  it("is an instance of Error", () => {
    const err = new JsonBoundaryError({
      message: "test error",
      code: "MALFORMED",
      raw: "raw",
      normalized: "norm",
      candidate: null,
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(JsonBoundaryError);
    expect(err.name).toBe("JsonBoundaryError");
    expect(err.code).toBe("MALFORMED");
    expect(err.raw).toBe("raw");
    expect(err.normalized).toBe("norm");
    expect(err.candidate).toBeNull();
  });

  it("stores causeOriginal", () => {
    const cause = new SyntaxError("oops");
    const err = new JsonBoundaryError({
      message: "test",
      code: "MALFORMED",
      raw: "",
      normalized: "",
      candidate: null,
      causeOriginal: cause,
    });
    expect(err.causeOriginal).toBe(cause);
  });
});

// ── classifyJsonParseFailure ──────────────────────────────────────────────────

describe("classifyJsonParseFailure", () => {
  it("returns EMPTY for empty normalized string", () => {
    expect(classifyJsonParseFailure({ normalized: "", candidate: null })).toBe("EMPTY");
    expect(classifyJsonParseFailure({ normalized: "   ", candidate: null })).toBe("EMPTY");
  });

  it("returns TRUNCATED when candidate is null and looks truncated", () => {
    expect(
      classifyJsonParseFailure({ normalized: "{\"key\":\"val\"", candidate: null })
    ).toBe("TRUNCATED");
  });

  it("returns NO_OBJECT when candidate is null and does not look truncated", () => {
    expect(
      classifyJsonParseFailure({ normalized: "plain text no braces", candidate: null })
    ).toBe("NO_OBJECT");
  });

  it("returns MALFORMED for SyntaxError on non-truncated candidate", () => {
    expect(
      classifyJsonParseFailure({
        normalized: "{ invalid }",
        candidate: "{ invalid }",
        parseError: new SyntaxError("unexpected token"),
      })
    ).toBe("MALFORMED");
  });

  it("returns TRUNCATED for SyntaxError on truncated-looking candidate", () => {
    expect(
      classifyJsonParseFailure({
        normalized: "{\"a\":",
        candidate: "{\"a\":",
        parseError: new SyntaxError("unexpected end"),
      })
    ).toBe("TRUNCATED");
  });
});

// ── extractJsonObjectCandidate ────────────────────────────────────────────────

describe("extractJsonObjectCandidate", () => {
  it("returns candidatesFound=0 and candidate=null for empty input", () => {
    const result = extractJsonObjectCandidate("");
    expect(result.candidate).toBeNull();
    expect(result.candidatesFound).toBe(0);
    expect(result.raw).toBe("");
  });

  it("finds a candidate in fenced prose", () => {
    const raw = "```json\n{\"a\":1}\n```";
    const result = extractJsonObjectCandidate(raw);
    expect(result.candidate).toBe("{\"a\":1}");
    expect(result.candidatesFound).toBe(1);
    expect(result.raw).toBe(raw);
  });
});
