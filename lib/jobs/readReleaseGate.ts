import {
  normalizeEvaluationJobStatus,
  normalizeEvaluationValidityStatus,
} from "@/lib/evaluation/status";

export function canReleaseEvaluationRead(input: {
  status: unknown;
  validity_status: unknown;
}): boolean {
  try {
    const status = normalizeEvaluationJobStatus(input.status);
    const validityStatus = normalizeEvaluationValidityStatus(input.validity_status);
    return status === "complete" && validityStatus === "valid";
  } catch {
    return false;
  }
}
