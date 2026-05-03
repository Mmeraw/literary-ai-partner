import type {
  EditorialDiagnostic,
  EditorialDiagnosticClassification,
} from "@/lib/evaluation/pipeline/types";

export type EditorialDiagnosticsFilter = {
  signal_id?: string;
  classification?: EditorialDiagnosticClassification;
  gate_check_id?: "recommendation_editorial_quality";
};

export function filterEditorialDiagnostics(
  diagnostics: EditorialDiagnostic[],
  filter: EditorialDiagnosticsFilter,
): EditorialDiagnostic[] {
  return diagnostics.filter((diagnostic) => {
    if (filter.signal_id && diagnostic.signal_id !== filter.signal_id) {
      return false;
    }

    if (
      filter.classification &&
      diagnostic.classification !== filter.classification
    ) {
      return false;
    }

    if (
      filter.gate_check_id &&
      diagnostic.gate_check_id !== filter.gate_check_id
    ) {
      return false;
    }

    return true;
  });
}
