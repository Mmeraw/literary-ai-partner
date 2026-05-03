import { describe, expect, it } from "@jest/globals";
import { filterEditorialDiagnostics } from "@/lib/evaluation/harness/admin-traceability";
import { buildEditorialDiagnosticsSummary } from "@/lib/evaluation/harness/report";
import type { EditorialDiagnostic } from "@/lib/evaluation/pipeline/types";

const DIAGNOSTICS: EditorialDiagnostic[] = [
  {
    signal_id: "editorial:1",
    criterion: "concept",
    action: "Introduce a concrete image in scene 1.",
    expected_impact: "Improves reader clarity.",
    anchor_snippet: "",
    evaluation_route: "recommendation_editorial_quality",
    missing_fields: ["anchor/context"],
    classification: "missing_anchor",
    action_applied: "block",
    gate_check_id: "recommendation_editorial_quality",
    error_code: "QG_EDITORIAL_GENERIC_FEEDBACK",
    failure_reason: "Missing fields: anchor/context",
    recommended_fix_path: "Provide concrete anchor context",
  },
  {
    signal_id: "editorial:2",
    criterion: "voice",
    action: "Replace diffuse line with concrete beat because stakes are unclear.",
    expected_impact: "Gives the reader stronger urgency.",
    anchor_snippet: "In the opening scene",
    evaluation_route: "recommendation_editorial_quality",
    missing_fields: [],
    classification: "generic_feedback",
    action_applied: "none",
    gate_check_id: "recommendation_editorial_quality",
    failure_reason: "Recommendation satisfies editorial quality contract",
    recommended_fix_path: "none",
  },
];

describe("editorial diagnostics admin traceability", () => {
  it("filters by signal_id, classification, and gate_check_id", () => {
    expect(filterEditorialDiagnostics(DIAGNOSTICS, { signal_id: "editorial:1" })).toHaveLength(1);
    expect(
      filterEditorialDiagnostics(DIAGNOSTICS, { classification: "missing_anchor" }),
    ).toHaveLength(1);
    expect(
      filterEditorialDiagnostics(DIAGNOSTICS, {
        gate_check_id: "recommendation_editorial_quality",
      }),
    ).toHaveLength(2);
  });

  it("builds v4 summary with stable count integrity", () => {
    const summary = buildEditorialDiagnosticsSummary(DIAGNOSTICS);

    expect(summary.reportVersion).toBe(4);
    expect(summary.total_diagnostics).toBe(2);
    expect(summary.rule_fire_counts.missing_anchor).toBe(1);
    expect(summary.rule_fire_counts.generic_feedback).toBe(1);
    expect(summary.block_reason_histogram.missing_anchor).toBe(1);

    const blockTotal = Object.values(summary.block_reason_histogram).reduce(
      (acc, value) => acc + value,
      0,
    );
    const blockedDiagnostics = DIAGNOSTICS.filter((d) => d.action_applied === "block").length;
    expect(blockTotal).toBe(blockedDiagnostics);
  });
});
