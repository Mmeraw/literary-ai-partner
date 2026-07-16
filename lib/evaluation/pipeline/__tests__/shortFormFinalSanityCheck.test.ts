/**
 * Fixture tests — short-form final sanity check copy-integrity backstop.
 *
 * These pin the persist-time referee for two Copy-Polish defects that must never
 * reach the author if they survived the normalizeArtifact pre-stage:
 *   A4  accidental adjacent-duplicate word  → SHORT_FORM_COPY_DEFECT
 *   D2  lowercase diagnostic opening         → SHORT_FORM_COPY_DEFECT
 *   mid-sentence invariant (dangling connective/comma) → SHORT_FORM_MIDSENTENCE_TERMINATION
 *
 * Both codes are BLOCKING (verdict BLOCK). The check makes the pass/fail
 * decision; the shared helpers only inspect. A clean report passes.
 */

import { describe, it, expect } from "@jest/globals";
import { runShortFormFinalSanityCheck } from "@/lib/evaluation/pipeline/shortFormFinalSanityCheck";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";

type Rec = {
  action?: string;
  symptom?: string;
  mechanism?: string;
  specific_fix?: string;
  reader_effect?: string;
  expected_impact?: string;
};

function buildResult(criteria: Array<{ rationale?: string; recommendations?: Rec[] }>): EvaluationResultV2 {
  return {
    overview: {
      verdict: "not_market_ready",
      one_paragraph_summary:
        "The excerpt shows a confident voice but pacing stalls before the mid-chapter turn.",
    },
    criteria: criteria.map(
      (c) =>
        ({
          key: "narrativeDrive",
          status: "SCORABLE",
          score_0_10: 7,
          scorable: true,
          scorability_status: "scorable_high_confidence",
          confidence_level: "medium",
          evidence: [{ snippet: "a sufficiently long verbatim anchor snippet here" }],
          rationale: c.rationale,
          recommendations: c.recommendations,
        }) as unknown as EvaluationResultV2["criteria"][number],
    ),
  } as unknown as EvaluationResultV2;
}

const CLEAN_RATIONALE =
  "The narrative momentum flows through the escalating penthouse conversation but stalls during exposition.";

describe("runShortFormFinalSanityCheck — copy-integrity backstop", () => {
  it("A4: flags an accidental adjacent-duplicate word in a symptom", () => {
    const result = buildResult([
      {
        rationale: CLEAN_RATIONALE,
        recommendations: [
          {
            symptom:
              "The passage reflective passage stalls forward momentum before the narrative urgency peaks.",
          },
        ],
      },
    ]);
    const out = runShortFormFinalSanityCheck({ wordCount: 4200, evaluationResult: result });
    expect(out.codes).toContain("SHORT_FORM_COPY_DEFECT");
    expect(out.verdict).toBe("BLOCK");
    expect(out.blocking).toBe(true);
  });

  it("D2: flags a lowercase diagnostic opening as a copy defect", () => {
    const result = buildResult([
      {
        rationale: CLEAN_RATIONALE,
        recommendations: [
          { symptom: "the stakes signal arrives too late for the reader to feel the turn." },
        ],
      },
    ]);
    const out = runShortFormFinalSanityCheck({ wordCount: 4200, evaluationResult: result });
    expect(out.codes).toContain("SHORT_FORM_COPY_DEFECT");
    expect(out.blocking).toBe(true);
  });

  it("mid-sentence: flags a diagnostic field ending on a dangling connective", () => {
    const result = buildResult([
      {
        rationale: CLEAN_RATIONALE,
        recommendations: [
          {
            expected_impact: "The reader loses momentum because",
          },
        ],
      },
    ]);
    const out = runShortFormFinalSanityCheck({ wordCount: 4200, evaluationResult: result });
    expect(out.codes).toContain("SHORT_FORM_MIDSENTENCE_TERMINATION");
    expect(out.verdict).toBe("BLOCK");
    expect(out.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SHORT_FORM_MIDSENTENCE_TERMINATION",
          field: "criteria[0].recommendations[0].expected_impact",
        }),
      ]),
    );
  });

  it("does not block hyphenated words that end with a dangling-word token", () => {
    const result = buildResult([
      {
        rationale: CLEAN_RATIONALE,
        recommendations: [
          {
            mechanism: "Weakening reader buy-in",
          },
        ],
      },
    ]);
    const out = runShortFormFinalSanityCheck({ wordCount: 4200, evaluationResult: result });
    expect(out.codes).not.toContain("SHORT_FORM_MIDSENTENCE_TERMINATION");
    expect(out.verdict).toBe("PASS");
  });

  it("passes a clean short-form report with no copy defects", () => {
    const result = buildResult([
      {
        rationale: CLEAN_RATIONALE,
        recommendations: [
          {
            symptom: "The stakes signal arrives too late in the scene.",
            specific_fix: "Move the consequence beat one paragraph earlier.",
          },
        ],
      },
    ]);
    const out = runShortFormFinalSanityCheck({ wordCount: 4200, evaluationResult: result });
    expect(out.codes).not.toContain("SHORT_FORM_COPY_DEFECT");
    expect(out.codes).not.toContain("SHORT_FORM_MIDSENTENCE_TERMINATION");
    expect(out.verdict).toBe("PASS");
  });

  it("skips long-form manuscripts (>= 25k words)", () => {
    const result = buildResult([
      {
        rationale: CLEAN_RATIONALE,
        recommendations: [{ symptom: "the passage reflective passage stalls." }],
      },
    ]);
    const out = runShortFormFinalSanityCheck({ wordCount: 42000, evaluationResult: result });
    expect(out.verdict).toBe("PASS");
    expect(out.codes).toEqual(["SHORT_FORM_SANITY_PASS"]);
  });
});
