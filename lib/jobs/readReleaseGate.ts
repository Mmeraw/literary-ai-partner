import {
  normalizeEvaluationJobStatus,
  normalizeEvaluationValidityStatus,
} from "@/lib/evaluation/status";

export const RELEASE_CONFIDENCE_THRESHOLD = 0.65;

export type EvaluationReleaseBlockReason =
  | "malformed_state"
  | "job_not_complete"
  | "invalid_evaluation"
  | "low_confidence";

export type EvaluationReleaseDecision =
  | { releasable: true }
  | {
      releasable: false;
      reason: EvaluationReleaseBlockReason;
      status?: string;
      validity_status?: string;
      confidence?: number;
    };

function parseConfidence(input: {
  confidence_0_1?: unknown;
  accepted_low_confidence?: unknown;
  evaluation_result?: unknown;
}): { confidence: number | null; acceptedLowConfidence: boolean } {
  const acceptedLowConfidence = input.accepted_low_confidence === true;

  // Validate direct confidence_0_1 field
  if (typeof input.confidence_0_1 === "number") {
    // Reject NaN, Infinity, and out-of-range values
    if (!Number.isFinite(input.confidence_0_1) || input.confidence_0_1 < 0 || input.confidence_0_1 > 1) {
      return {
        confidence: null,
        acceptedLowConfidence,
      };
    }
    return {
      confidence: input.confidence_0_1,
      acceptedLowConfidence,
    };
  }

  // Try to extract nested confidence from evaluation_result.governance
  const nestedConfidence =
    input.evaluation_result &&
    typeof input.evaluation_result === "object" &&
    input.evaluation_result !== null &&
    "governance" in input.evaluation_result
      ? (input.evaluation_result as { governance?: { confidence?: unknown } }).governance
          ?.confidence
      : undefined;

  if (typeof nestedConfidence === "number") {
    // Reject NaN, Infinity, and out-of-range values
    if (!Number.isFinite(nestedConfidence) || nestedConfidence < 0 || nestedConfidence > 1) {
      return {
        confidence: null,
        acceptedLowConfidence,
      };
    }
    return {
      confidence: nestedConfidence,
      acceptedLowConfidence,
    };
  }

  return {
    confidence: null,
    acceptedLowConfidence,
  };
}

export function getEvaluationReleaseDecision(input: {
  status: unknown;
  validity_status: unknown;
  confidence_0_1?: unknown;
  accepted_low_confidence?: unknown;
  evaluation_result?: unknown;
}): EvaluationReleaseDecision {
  try {
    const status = normalizeEvaluationJobStatus(input.status);
    const validityStatus = normalizeEvaluationValidityStatus(input.validity_status);

    if (status !== "complete") {
      return {
        releasable: false,
        reason: "job_not_complete",
        status,
        validity_status: validityStatus,
      };
    }

    if (validityStatus !== "valid") {
      return {
        releasable: false,
        reason: "invalid_evaluation",
        status,
        validity_status: validityStatus,
      };
    }

    // Check for malformed confidence data before parsing
    // If confidence_0_1 is present but not a valid number, it's malformed
    if (
      input.confidence_0_1 !== undefined &&
      typeof input.confidence_0_1 === "number" &&
      (!Number.isFinite(input.confidence_0_1) ||
        input.confidence_0_1 < 0 ||
        input.confidence_0_1 > 1)
    ) {
      return {
        releasable: false,
        reason: "malformed_state",
        status,
        validity_status: validityStatus,
        confidence: input.confidence_0_1 as number,
      };
    }

    // Check for malformed nested confidence in evaluation_result.governance
    const nestedConfidence =
      input.evaluation_result &&
      typeof input.evaluation_result === "object" &&
      input.evaluation_result !== null &&
      "governance" in input.evaluation_result
        ? (input.evaluation_result as { governance?: { confidence?: unknown } }).governance
            ?.confidence
        : undefined;

    if (
      nestedConfidence !== undefined &&
      typeof nestedConfidence === "number" &&
      (!Number.isFinite(nestedConfidence) || nestedConfidence < 0 || nestedConfidence > 1)
    ) {
      return {
        releasable: false,
        reason: "malformed_state",
        status,
        validity_status: validityStatus,
        confidence: nestedConfidence as number,
      };
    }

    const { confidence, acceptedLowConfidence } = parseConfidence(input);
    if (
      typeof confidence === "number" &&
      confidence < RELEASE_CONFIDENCE_THRESHOLD &&
      !acceptedLowConfidence
    ) {
      return {
        releasable: false,
        reason: "low_confidence",
        status,
        validity_status: validityStatus,
        confidence,
      };
    }

    return { releasable: true };
  } catch {
    return {
      releasable: false,
      reason: "malformed_state",
    };
  }
}

export function canReleaseEvaluationRead(input: {
  status: unknown;
  validity_status: unknown;
  confidence_0_1?: unknown;
  accepted_low_confidence?: unknown;
  evaluation_result?: unknown;
}): boolean {
  return getEvaluationReleaseDecision(input).releasable;
}
