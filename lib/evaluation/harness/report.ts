import type {
  EditorialDiagnostic,
  EditorialDiagnosticClassification,
  EditorialDiagnosticsSummary,
} from "@/lib/evaluation/pipeline/types";

const EDITORIAL_DIAGNOSTIC_CLASSIFICATIONS: EditorialDiagnosticClassification[] = [
  "generic_feedback",
  "missing_symptom",
  "missing_mechanism",
  "missing_fix",
  "missing_reader_effect",
  "missing_anchor",
  "duplicate_reasoning",
];

function buildEmptyClassificationCounts(): Record<EditorialDiagnosticClassification, number> {
  return EDITORIAL_DIAGNOSTIC_CLASSIFICATIONS.reduce(
    (acc, classification) => {
      acc[classification] = 0;
      return acc;
    },
    {} as Record<EditorialDiagnosticClassification, number>,
  );
}

export function buildEditorialDiagnosticsSummary(
  diagnostics: EditorialDiagnostic[],
): EditorialDiagnosticsSummary {
  const ruleFireCounts = buildEmptyClassificationCounts();
  const blockReasonHistogram = buildEmptyClassificationCounts();

  for (const diagnostic of diagnostics) {
    ruleFireCounts[diagnostic.classification] += 1;

    if (diagnostic.action_applied === "block") {
      blockReasonHistogram[diagnostic.classification] += 1;
    }
  }

  return {
    reportVersion: 4,
    total_diagnostics: diagnostics.length,
    rule_fire_counts: ruleFireCounts,
    block_reason_histogram: blockReasonHistogram,
  };
}
