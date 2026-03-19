import {
  RevisionFailureCode,
  getRevisionFailureDetails,
} from "@/lib/errors/revisionCodes";

export type ClassifiedApplyFailure = {
  code: RevisionFailureCode;
  detail: string;
  message: string;
};

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim();
  }

  if (typeof error === "string") {
    return error.trim();
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function classifyApplyFailureCode(error: unknown): RevisionFailureCode {
  const message = normalizeErrorMessage(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("appears multiple times") ||
    lower.includes("multiple anchor matches") ||
    lower.includes("anchor_ambiguous") ||
    lower.includes("ambiguous")
  ) {
    return RevisionFailureCode.ANCHOR_AMBIGUOUS;
  }

  if (
    lower.includes("before/after context verification failed") ||
    lower.includes("context verification failed") ||
    lower.includes("context_mismatch")
  ) {
    return RevisionFailureCode.CONTEXT_MISMATCH;
  }

  if (
    lower.includes("duplicate proposal range detected") ||
    lower.includes("apply collision") ||
    lower.includes("already-applied")
  ) {
    return RevisionFailureCode.APPLY_COLLISION;
  }

  if (
    lower.includes("overlapping proposals detected") ||
    lower.includes("anchor range exceeds source length") ||
    lower.includes("offset_conflict")
  ) {
    return RevisionFailureCode.OFFSET_CONFLICT;
  }

  if (
    lower.includes("missing valid anchor offsets") ||
    lower.includes("must be a non-negative integer") ||
    lower.includes("input could not be parsed") ||
    lower.includes("parse_error") ||
    lower.includes("malformed")
  ) {
    return RevisionFailureCode.PARSE_ERROR;
  }

  if (
    lower.includes("source slice does not match original_text") ||
    lower.includes("anchored slice does not match original_text") ||
    lower.includes("not found in source text") ||
    lower.includes("anchor miss")
  ) {
    return RevisionFailureCode.ANCHOR_MISS;
  }

  if (
    lower.includes("extraction contract violation") ||
    lower.includes("invariant") ||
    lower.includes("illegal")
  ) {
    return RevisionFailureCode.INVARIANT_VIOLATION;
  }

  // Fail closed to canonical, non-generic code.
  return RevisionFailureCode.INVARIANT_VIOLATION;
}

export function classifyApplyFailure(error: unknown): ClassifiedApplyFailure {
  const code = classifyApplyFailureCode(error);
  const detail = normalizeErrorMessage(error);
  const descriptor = getRevisionFailureDetails(code);

  return {
    code,
    detail,
    message: descriptor.message,
  };
}

export function buildApplyFailureEnvelope(
  error: unknown,
  context: Record<string, unknown> = {},
): {
  code: RevisionFailureCode;
  message: string;
  retryable: false;
  phase: "phase_2";
  context: Record<string, unknown>;
  occurred_at: string;
} {
  const classified = classifyApplyFailure(error);

  return {
    code: classified.code,
    message: `${classified.message} Detail: ${classified.detail}`,
    retryable: false,
    phase: "phase_2",
    context: {
      classifier: "revision.apply",
      detail: classified.detail,
      ...context,
    },
    occurred_at: new Date().toISOString(),
  };
}
