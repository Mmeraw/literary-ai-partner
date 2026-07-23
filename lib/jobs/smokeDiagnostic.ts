import { isRetryableFailureCode } from "./failures";

export type SmokeDiagnosticCategory =
  | "transient_execution"
  | "provider_response_invalid"
  | "input_validation"
  | "quality_gate"
  | "governance_block"
  | "finalizer_error"
  | "authz"
  | "unknown";

export interface SmokeDiagnosticResult {
  category: SmokeDiagnosticCategory;
  retryable: boolean;
  summary: string;
}

function categoryForFailureCode(code: string): SmokeDiagnosticCategory {
  const upper = code.toUpperCase();

  if (
    [
      "TIMEOUT",
      "UPSTREAM_ERROR",
      "RATE_LIMITED",
      "INTERNAL_ERROR",
      "LEASE_EXPIRED",
      "CLAIM_RPC_FAILED",
      "DB_WRITE_FAILED",
      "SEED_GENERATION_FAILED",
      "WAVE_EXECUTION_TIMEOUT",
      "DREAM_TIMEOUT",
    ].includes(upper) ||
    /\b(TIMEOUT|RATE_LIMIT|UPSTREAM|NETWORK|SERVICE_UNAVAILABLE|PROVIDER_ERROR|INTERNAL)\b/.test(upper)
  ) {
    return "transient_execution";
  }

  if (
    upper.startsWith("PASS1_FAILED") ||
    upper.startsWith("PASS2_FAILED") ||
    upper.startsWith("PASS3_") ||
    upper.startsWith("PASS_") ||
    upper.includes("TEXT_INTEGRITY") ||
    upper.includes("TEXT_CONTRACT") ||
    upper.includes("ARTIFACT_CONSISTENCY") ||
    upper === "CONTEXT_CONTAMINATION_DETECTED" ||
    upper === "LONG_FORM_CHUNK_MATERIALIZATION_FAILED"
  ) {
    return "provider_response_invalid";
  }

  if (
    [
      "INVALID_INPUT",
      "PIPELINE_INPUT_INVALID",
      "MANUSCRIPT_NOT_FOUND",
      "CHUNK_MISSING",
      "CHUNK_BUDGET_OVERFLOW",
      "SCHEMA_VALIDATION_FAILED",
      "SCHEMA_ERROR",
      "VALIDATION_ERROR",
    ].includes(upper) ||
    upper.startsWith("SCHEMA_") ||
    upper.startsWith("INVALID_")
  ) {
    return "input_validation";
  }

  if (
    upper.startsWith("QG_") ||
    upper.includes("COMPLETENESS") ||
    upper.includes("CONSISTENCY") ||
    upper === "CRITERION_OPPORTUNITY_COVERAGE_INVALID" ||
    upper === "ECG_CERTIFICATION_FAILED"
  ) {
    return "quality_gate";
  }

  if (
    [
      "EVALUATION_GATE_REJECTED",
      "GOVERNANCE_BLOCK",
      "STATE_TRANSITION_INVALID",
      "ANCHOR_CONTRACT_VIOLATION",
      "PASS_CONVERGENCE_FAILURE",
      "MAX_RETRIES_EXCEEDED",
    ].includes(upper)
  ) {
    return "governance_block";
  }

  if (
    [
      "MISSING_PASS_ARTIFACT",
      "CANONICAL_ARTIFACT_WRITE_FAILED",
      "SUMMARY_PROJECTION_FAILED",
    ].includes(upper)
  ) {
    return "finalizer_error";
  }

  if (upper.includes("AUTH") || upper.includes("FORBIDDEN") || upper.includes("UNAUTHORIZED")) {
    return "authz";
  }

  return "unknown";
}

export function classifySmokeDiagnostic(
  failureCode: string | null | undefined,
  phase: string | null | undefined,
): SmokeDiagnosticResult {
  const code = failureCode ?? "UNKNOWN";
  const category = categoryForFailureCode(code);
  const retryable = isRetryableFailureCode(code);
  const phaseLabel = phase ?? "unknown";
  const summary =
    `Evaluation failed at ${phaseLabel} with failure code ${code} (category: ${category}). ` +
    `Retryable: ${retryable ? "yes" : "no"}.`;

  return { category, retryable, summary };
}
