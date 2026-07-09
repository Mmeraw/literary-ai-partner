/**
 * Fixture test — recommendation integrity gate copy-integrity detection (A3).
 *
 * A3's exact broken headline from the Copy-Polish brief has three faults:
 *   (1) lowercase opening ("insert …")                → NO_LOWERCASE_OPENING
 *   (2) fused fix-direction / reader-effect fields with no boundary between
 *       them (a run-on the gate reads as an incomplete/fragmented field)
 *                                                       → INCOMPLETE_FIELD
 *   (3) no sentence-terminal punctuation on the underlying prose (masked only by
 *       the trailing "(Narrative Drive & Momentum)" criterion tag)
 *
 * The gate holds the pass/fail authority; the shared helpers only inspect. The
 * exact broken string must be KICKED BACK (passed === false). A clean,
 * capitalized, well-formed field must not raise the copy-integrity codes.
 */

import { describe, it, expect } from "@jest/globals";
import { checkRecommendationIntegrity } from "@/lib/evaluation/pipeline/recommendationIntegrityGate";

// Exact source string from the brief (defect A3).
const A3_BROKEN =
  "insert one concrete stakes beat that lands the deferred decision at the current scene turn increased momentum as the stalled decision converts to visible consequence (Narrative Drive & Momentum)";

describe("recommendationIntegrityGate — A3 broken headline fixture", () => {
  it("flags the lowercase opening on the exact A3 string", () => {
    const result = checkRecommendationIntegrity({ action: A3_BROKEN });
    expect(result.violations.map((v) => v.code)).toContain("NO_LOWERCASE_OPENING");
  });

  it("kicks back the fused/fragmented run-on on the exact A3 string", () => {
    const result = checkRecommendationIntegrity({ action: A3_BROKEN });
    // The fused fix-direction/reader-effect run-on reads as an incomplete field.
    expect(result.violations.map((v) => v.code)).toContain("INCOMPLETE_FIELD");
    expect(result.passed).toBe(false);
  });

  it("does not flag a capitalized, well-formed action (no false positive)", () => {
    const result = checkRecommendationIntegrity({
      action:
        "Insert one concrete stakes beat that lands the deferred decision at the current scene turn.",
    });
    expect(result.violations.map((v) => v.code)).not.toContain("NO_LOWERCASE_OPENING");
  });
});
