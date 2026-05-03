import type {
  EditorialDiagnostic,
  EditorialDiagnosticsSummary,
} from "@/lib/evaluation/pipeline/types";

export function buildEditorialDiagnosticsSummary(
  diagnostics: EditorialDiagnostic[],
): EditorialDiagnosticsSummary {
  const ruleFireCounts: Record<string, number> = {};
  const blockReasonHistogram: Record<string, number> = {};

  for (const diagnostic of diagnostics) {
    ruleFireCounts[diagnostic.classification] =
      (ruleFireCounts[diagnostic.classification] ?? 0) + 1;

    if (diagnostic.action_applied === "block") {
      blockReasonHistogram[diagnostic.classification] =
        (blockReasonHistogram[diagnostic.classification] ?? 0) + 1;
    }
  }

  return {
    reportVersion: 4,
    total_diagnostics: diagnostics.length,
    rule_fire_counts: ruleFireCounts,
    block_reason_histogram: blockReasonHistogram,
  };
}
