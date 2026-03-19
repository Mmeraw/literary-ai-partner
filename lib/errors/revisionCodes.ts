/**
 * Phase 2.4.a — Revision Failure Classification
 *
 * Closed set of machine-readable failure codes for revision/apply failures.
 *
 * GOVERNANCE:
 * - This enum is intentionally closed (no UNKNOWN code).
 * - Callers must map every reproducible failure path to one of these codes.
 * - Prefer explicit failure over generic fallback.
 */

export enum RevisionFailureCode {
  /** Anchor not found in source text at expected location/context */
  ANCHOR_MISS = "ANCHOR_MISS",

  /** Anchor search produced multiple plausible matches */
  ANCHOR_AMBIGUOUS = "ANCHOR_AMBIGUOUS",

  /** Before/after context does not match expected source window */
  CONTEXT_MISMATCH = "CONTEXT_MISMATCH",

  /** Offset/range conflicts with other edits or preconditions */
  OFFSET_CONFLICT = "OFFSET_CONFLICT",

  /** Input payload malformed or unparsable */
  PARSE_ERROR = "PARSE_ERROR",

  /** Contract or invariant violation (bounds, required fields, transitions) */
  INVARIANT_VIOLATION = "INVARIANT_VIOLATION",

  /** Duplicate/colliding apply operation against same effective span */
  APPLY_COLLISION = "APPLY_COLLISION",
}

export type RevisionFailureSeverity = "retryable" | "non_retryable";

export type RevisionFailureDescriptor = {
  message: string;
  severity: RevisionFailureSeverity;
};

/**
 * Human-readable metadata for each failure code.
 */
export const REVISION_FAILURE_DETAILS: Record<RevisionFailureCode, RevisionFailureDescriptor> = {
  [RevisionFailureCode.ANCHOR_MISS]: {
    message: "Anchor could not be located in source text.",
    severity: "non_retryable",
  },
  [RevisionFailureCode.ANCHOR_AMBIGUOUS]: {
    message: "Multiple anchor matches found; apply cannot choose safely.",
    severity: "non_retryable",
  },
  [RevisionFailureCode.CONTEXT_MISMATCH]: {
    message: "Anchor context does not match source text.",
    severity: "non_retryable",
  },
  [RevisionFailureCode.OFFSET_CONFLICT]: {
    message: "Proposal offset conflicts with other edits or current text state.",
    severity: "non_retryable",
  },
  [RevisionFailureCode.PARSE_ERROR]: {
    message: "Input could not be parsed into a valid revision/apply structure.",
    severity: "retryable",
  },
  [RevisionFailureCode.INVARIANT_VIOLATION]: {
    message: "Invariant check failed for revision/apply operation.",
    severity: "non_retryable",
  },
  [RevisionFailureCode.APPLY_COLLISION]: {
    message: "Apply operation collides with an already-applied or duplicate span.",
    severity: "non_retryable",
  },
};

/**
 * Type guard for validating unknown values from persistence/network boundaries.
 */
export function isRevisionFailureCode(value: unknown): value is RevisionFailureCode {
  return (
    typeof value === "string" &&
    (Object.values(RevisionFailureCode) as string[]).includes(value)
  );
}

/**
 * Retrieve stable metadata for a failure code.
 */
export function getRevisionFailureDetails(code: RevisionFailureCode): RevisionFailureDescriptor {
  return REVISION_FAILURE_DETAILS[code];
}
