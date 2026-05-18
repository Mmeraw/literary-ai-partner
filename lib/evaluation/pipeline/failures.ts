/**
 * Failure Code Taxonomy — RevisionGrade Runtime
 * Retry is allowed ONLY for transient codes.
 * Canonical rejection is non-transient and fail-closed.
 */

export const EVALUATION_ARTIFACT_VALIDATION_FAILED =
  "EVALUATION_ARTIFACT_VALIDATION_FAILED" as const;

export const FAILURE_CODES = [
  // Transient (retry allowed)
  "TRANSIENT_NETWORK",
  "TRANSIENT_UPSTREAM",
  "RATE_LIMITED",
  // Non-transient (fail closed, no retry)
  "VALIDATION_ERROR",
  "SCHEMA_ERROR",
  "GOVERNANCE_BLOCK",
  "ANCHOR_CONTRACT_VIOLATION",
  "MISSING_PASS_ARTIFACT",
  "PASS_CONVERGENCE_FAILURE",
  "CANONICAL_ARTIFACT_WRITE_FAILED",
  "SUMMARY_PROJECTION_FAILED",
  "LEASE_EXPIRED",
  "STATE_TRANSITION_INVALID",
  "RLS_BLOCKED",
  "MANUAL_REVIEW_REQUIRED",
  "EVALUATION_GATE_REJECTED",
  "MANUSCRIPT_EXCEEDS_HARD_CEILING",
  "CHUNK_COUNT_EXCEEDS_CAP",
  "MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE",
  "CHUNK_ROUTING_NOT_ENGAGED",
  EVALUATION_ARTIFACT_VALIDATION_FAILED,
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

export const FAILURE_CODE_SET: ReadonlySet<string> = new Set(FAILURE_CODES);

export const FAILURE_CODE_METADATA: Readonly<
  Record<
    FailureCode,
    {
      classification: "transient" | "validation" | "system";
      validity_status: "pending" | "valid" | "invalid" | "quarantined";
      description: string;
    }
  >
> = {
  TRANSIENT_NETWORK: {
    classification: "transient",
    validity_status: "pending",
    description: "Network transport failure while executing evaluation runtime.",
  },
  TRANSIENT_UPSTREAM: {
    classification: "transient",
    validity_status: "pending",
    description: "Transient upstream provider failure.",
  },
  RATE_LIMITED: {
    classification: "transient",
    validity_status: "pending",
    description: "Provider or platform rate-limit condition.",
  },
  VALIDATION_ERROR: {
    classification: "validation",
    validity_status: "invalid",
    description: "Generic validation failure.",
  },
  SCHEMA_ERROR: {
    classification: "validation",
    validity_status: "invalid",
    description: "Schema mismatch or malformed payload.",
  },
  GOVERNANCE_BLOCK: {
    classification: "validation",
    validity_status: "invalid",
    description: "Governance policy blocked artifact release.",
  },
  ANCHOR_CONTRACT_VIOLATION: {
    classification: "validation",
    validity_status: "invalid",
    description: "Evidence anchor contract violated.",
  },
  MISSING_PASS_ARTIFACT: {
    classification: "system",
    validity_status: "invalid",
    description: "Required pass artifact missing at merge phase.",
  },
  PASS_CONVERGENCE_FAILURE: {
    classification: "validation",
    validity_status: "invalid",
    description: "Pass outputs failed convergence policy.",
  },
  CANONICAL_ARTIFACT_WRITE_FAILED: {
    classification: "system",
    validity_status: "invalid",
    description: "Canonical artifact persistence failed.",
  },
  SUMMARY_PROJECTION_FAILED: {
    classification: "system",
    validity_status: "invalid",
    description: "Summary projection failed during finalization.",
  },
  LEASE_EXPIRED: {
    classification: "system",
    validity_status: "invalid",
    description: "Worker lease expired during execution.",
  },
  STATE_TRANSITION_INVALID: {
    classification: "system",
    validity_status: "invalid",
    description: "Illegal state transition attempted.",
  },
  RLS_BLOCKED: {
    classification: "system",
    validity_status: "invalid",
    description: "Row-level security blocked required mutation.",
  },
  MANUAL_REVIEW_REQUIRED: {
    classification: "validation",
    validity_status: "quarantined",
    description: "Artifact requires manual review before release.",
  },
  EVALUATION_GATE_REJECTED: {
    classification: "validation",
    validity_status: "invalid",
    description: "Quality gate rejected the artifact.",
  },
  EVALUATION_ARTIFACT_VALIDATION_FAILED: {
    classification: "validation",
    validity_status: "invalid",
    description: "Artifact failed structural validation before persistence.",
  },
  MANUSCRIPT_EXCEEDS_HARD_CEILING: {
    classification: "validation",
    validity_status: "invalid",
    description:
      "Manuscript word count exceeds the hard evaluation capacity ceiling. Split into volumes.",
  },
  CHUNK_COUNT_EXCEEDS_CAP: {
    classification: "validation",
    validity_status: "invalid",
    description:
      "Chunk count exceeds the configured per-pass cap (EVAL_CHUNK_MAX_PER_PASS). Fail-closed instead of silent truncation.",
  },
  MANUSCRIPT_CHUNK_COVERAGE_INCOMPLETE: {
    classification: "validation",
    validity_status: "invalid",
    description:
      "Chunk coverage did not process the full manuscript (chunk mismatch or <99% analyzed-word ratio).",
  },
  CHUNK_ROUTING_NOT_ENGAGED: {
    classification: "system",
    validity_status: "invalid",
    description:
      "Manuscript exceeded the structural chunking threshold but Pass 1 received ≤ 1 chunk. Silent direct_window fallback refused.",
  },
};

const TRANSIENT_CODES: ReadonlySet<FailureCode> = new Set([
  "TRANSIENT_NETWORK",
  "TRANSIENT_UPSTREAM",
  "RATE_LIMITED",
]);

export interface RuntimeFailure extends Error {
  failureCode: FailureCode;
  detail?: unknown;
  retryable: boolean;
}

export function isTransientFailure(code: FailureCode): boolean {
  return TRANSIENT_CODES.has(code);
}

export function isNonTransientFailure(code: FailureCode): boolean {
  return !TRANSIENT_CODES.has(code);
}

export function assertValidFailureCode(
  code: string,
): asserts code is FailureCode {
  if (!FAILURE_CODE_SET.has(code)) {
    throw new Error(`Invalid failure code: ${code}`);
  }
}

export function createRuntimeFailure(
  failureCode: FailureCode,
  message: string,
  detail?: unknown,
): RuntimeFailure {
  const err = new Error(message) as RuntimeFailure;
  err.failureCode = failureCode;
  err.detail = detail;
  err.retryable = isTransientFailure(failureCode);
  return err;
}

export function createEvaluationGateRejectedFailure(
  message: string,
  detail?: unknown,
): RuntimeFailure {
  return createRuntimeFailure("EVALUATION_GATE_REJECTED", message, detail);
}

export function isEvaluationGateRejected(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "failureCode" in error &&
    (error as { failureCode?: unknown }).failureCode ===
      "EVALUATION_GATE_REJECTED"
  );
}

/**
 * Error thrown when the evaluation gate rejects a chunk.
 * Non-retryable by design — canonical rejection.
 */
export class EvaluationGateRejectedError extends Error {
  public readonly failureCode = "EVALUATION_GATE_REJECTED" as const;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "EvaluationGateRejectedError";
    this.details = details;
  }
}

/**
 * Error thrown when a manuscript exceeds the hard evaluation capacity ceiling.
 * Non-retryable. Surfaced to the user with a "split into volumes" message.
 */
export class ManuscriptExceedsHardCeilingError extends Error {
  public readonly failureCode = "MANUSCRIPT_EXCEEDS_HARD_CEILING" as const;
  public readonly code = "MANUSCRIPT_EXCEEDS_HARD_CEILING" as const;
  public readonly retryable = false;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ManuscriptExceedsHardCeilingError";
    this.details = details;
  }
}

/**
 * Error thrown when a manuscript produces more chunks than the configured
 * per-pass cap (EVAL_CHUNK_MAX_PER_PASS). Replaces the previous silent
 * truncation behaviour — every word must be evaluated or the job fails.
 */
export class ChunkCountExceedsCapError extends Error {
  public readonly failureCode = "CHUNK_COUNT_EXCEEDS_CAP" as const;
  public readonly code = "CHUNK_COUNT_EXCEEDS_CAP" as const;
  public readonly retryable = false;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ChunkCountExceedsCapError";
    this.details = details;
  }
}

/**
 * Error thrown when chunk-routed evaluation fails to engage above the
 * structural chunking threshold. Kills the silent fallback to direct_window
 * that produced 12-minute PASS1_TIMEOUT rows on long manuscripts.
 */
export class ChunkRoutingNotEngagedError extends Error {
  public readonly failureCode = "CHUNK_ROUTING_NOT_ENGAGED" as const;
  public readonly code = "CHUNK_ROUTING_NOT_ENGAGED" as const;
  public readonly retryable = false;
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ChunkRoutingNotEngagedError";
    this.details = details;
  }
}
