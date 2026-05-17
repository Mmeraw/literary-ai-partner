/**
 * Schema parity guard for Pass 4 cross-check.
 *
 * Background:
 *   The Perplexity JSON response schema (response_format) must stay in lockstep
 *   with `validateCanonCompleteness()` in `lib/evaluation/pipeline/perplexityCrossCheck.ts`.
 *   If the schema permits empty `detectedSignals` or `doctrineTrace` arrays but
 *   the canon validator rejects them, Pass 4 fails at runtime with
 *   PASS4_CANON_INVALID even though Perplexity satisfied the schema contract.
 *
 *   Reference incident: evaluation_jobs.fdda059f-44e8-45bb-86b6-0c35607ee928
 *   (Froggin Noggin, 2026-05-15, git_sha 3c1b551).
 *
 * This test pins the schema invariant so a future edit cannot silently re-open
 * the gap.
 */

import { describe, expect, it } from "@jest/globals";
import { buildPerplexityResponseSchema } from "@/lib/evaluation/pipeline/perplexityCrossCheckRequest";

const SAMPLE_CRITERIA = ["concept", "voice", "pacing"] as const;

type ArraySchema = {
  type: "array";
  minItems?: number;
  items?: unknown;
};

type CriterionSchema = {
  type: "object";
  properties: {
    evidence: ArraySchema;
    detectedSignals: ArraySchema;
    doctrineTrace: ArraySchema;
  };
  required: string[];
};

describe("buildPerplexityResponseSchema — canon validator parity", () => {
  const root = buildPerplexityResponseSchema(SAMPLE_CRITERIA) as {
    properties: {
      criteria: {
        properties: Record<string, CriterionSchema>;
      };
    };
  };

  const criterion = root.properties.criteria.properties.concept;

  it("requires every documented criterion field", () => {
    expect(criterion.required).toEqual(
      expect.arrayContaining([
        "score",
        "rationale",
        "evidence",
        "detectedSignals",
        "scoringBand",
        "doctrineTrace",
      ]),
    );
  });

  it("enforces minItems: 1 on evidence", () => {
    expect(criterion.properties.evidence.type).toBe("array");
    expect(criterion.properties.evidence.minItems).toBe(1);
  });

  it("enforces minItems: 1 on detectedSignals (canon-validator parity)", () => {
    // validateCanonCompleteness() rejects criteria with empty detectedSignals.
    // The schema MUST forbid empty arrays so Perplexity strict-mode refuses
    // to emit them.
    expect(criterion.properties.detectedSignals.type).toBe("array");
    expect(criterion.properties.detectedSignals.minItems).toBe(1);
  });

  it("enforces minItems: 1 on doctrineTrace (canon-validator parity)", () => {
    // validateCanonCompleteness() rejects criteria with empty doctrineTrace.
    expect(criterion.properties.doctrineTrace.type).toBe("array");
    expect(criterion.properties.doctrineTrace.minItems).toBe(1);
  });

  it("applies the same shape to every criterion", () => {
    for (const key of SAMPLE_CRITERIA) {
      const c = root.properties.criteria.properties[key];
      expect(c.properties.detectedSignals.minItems).toBe(1);
      expect(c.properties.doctrineTrace.minItems).toBe(1);
      expect(c.properties.evidence.minItems).toBe(1);
    }
  });
});
