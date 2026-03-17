/**
 * Governance-specific errors for canon enforcement and eligibility gating.
 *
 * All errors in this module are fail-closed and prevent further pipeline
 * execution when governance constraints are violated.
 */

export class GovernanceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CANON_INACTIVE"
      | "CANON_NOT_FOUND"
      | "CRITERIA_SCHEMA_VIOLATION"
      | "ELIGIBILITY_GATE_BLOCK"
      | "REFINEMENT_BLOCKED_BY_GATE"
      | "STRUCTURAL_FAILURE",
    public readonly metadata?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GovernanceError";
    Error.captureStackTrace(this, GovernanceError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
    };
  }
}
