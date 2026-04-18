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

  if (typeof input.confidence_0_1 === "number") {
    return {
      confidence: input.confidence_0_1,
      acceptedLowConfidence,
    };
  }

  const nestedConfidence =
    input.evaluation_result &&
    typeof input.evaluation_result === "object" &&
    input.evaluation_result !== null &&
    "governance" in input.evaluation_result
      ? (input.evaluation_result as { governance?: { confidence?: unknown } }).governance
          ?.confidence
      : undefined;

  return {
    confidence: typeof nestedConfidence === "number" ? nestedConfidence : null,
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
