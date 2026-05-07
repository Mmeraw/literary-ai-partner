import { hasTextualAnchorSignal, normalizeSmartQuotes } from "../runPipeline";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";

type Criterion = EvaluationResultV2["criteria"][number];

function criterion(overrides: Partial<Criterion>): Criterion {
  return {
    key: "proseControl",
    status: "SCORABLE",
    score_0_10: 6,
    rationale: "",
    recommendations: [],
    evidence: [],
    confidence_level: "moderate",
    confidence_band: "MEDIUM",
    confidence_score_0_100: 70,
    confidence_reasons: [],
    signal_present: true,
    signal_strength: "SUFFICIENT",
    scorability_status: "scorable",
    ...overrides,
  } as Criterion;
}

describe("textual anchor confidence quote normalization", () => {
  test("normalizes curly smart quotes to straight double quotes", () => {
    expect(normalizeSmartQuotes("“grey gauze across the water”")).toBe(
      '"grey gauze across the water"',
    );
  });

  test("straight-quoted rationale anchor is detected", () => {
    expect(
      hasTextualAnchorSignal(
        criterion({
          rationale: 'Sentence rhythm is anchored by "grey gauze across the water".',
        }),
      ),
    ).toBe(true);
  });

  test("curly-quoted rationale anchor is detected after normalization", () => {
    expect(
      hasTextualAnchorSignal(
        criterion({
          rationale: "Sentence rhythm is anchored by “grey gauze across the water”.",
        }),
      ),
    ).toBe(true);
  });

  test("unquoted evidence snippet of at least 20 chars is detected", () => {
    expect(
      hasTextualAnchorSignal(
        criterion({
          rationale: "No quoted rationale here.",
          evidence: [
            {
              snippet: "the light thinned to grey gauze across the water",
              location: { char_start: 0, char_end: 48 },
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  test("unquoted evidence snippet under 20 chars is rejected", () => {
    expect(
      hasTextualAnchorSignal(
        criterion({
          rationale: "No quoted rationale here.",
          evidence: [
            {
              snippet: "short anchor",
              location: { char_start: 0, char_end: 12 },
            },
          ],
        }),
      ),
    ).toBe(false);
  });
});
