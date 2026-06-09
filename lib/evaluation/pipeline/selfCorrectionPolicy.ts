/**
 * Self-Correction Policy — runtime enforcement
 *
 * Defines what happens when pipeline gates detect violations:
 *   1. Quarantine (isolate bad content)
 *   2. Retry once (re-invoke with explicit failure context)
 *   3. Fail closed (mark terminal after retry exhaustion)
 *   4. Notify (admin-visible diagnostics + user-safe message)
 *
 * Canon authority: docs/doctrine/SELF_CORRECTION_POLICY.md
 * Gate references: S06b (Handoff), S07 (Integrity), S09 (QualityGateV2), S11b (Download)
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type GateFailurePolicy = {
  /** Maximum retry attempts before terminal failure (0 = never retry) */
  max_retries: number;
  /** Whether quarantine artifact should be persisted for admin inspection */
  persist_quarantine_artifact: boolean;
  /** User-safe message shown on the error page (never exposes internals) */
  user_safe_message: string;
  /** Admin-visible severity classification */
  severity: "critical" | "high" | "medium";
};

export type RetryContext = {
  /** Which gate failed */
  failed_gate: string;
  /** SIPOC stage identifier */
  stage_id: string;
  /** Which violation codes were raised */
  violation_codes: string[];
  /** Which specific criteria/fields violated */
  affected_fields: string[];
  /** Number of this retry attempt (1-indexed) */
  attempt_number: number;
  /** Prose instruction for the LLM on what to avoid */
  retry_instruction: string;
};

// ── Policy Registry ──────────────────────────────────────────────────────────

const USER_SAFE_QUALITY_MESSAGE =
  "Your evaluation encountered a quality issue and could not be completed. " +
  "Our team has been notified and the evaluation will be retried automatically. " +
  "If the issue persists, please contact support.";

const USER_SAFE_TERMINAL_MESSAGE =
  "Your evaluation could not be completed due to a processing issue. " +
  "Our team has been notified. Please try submitting again or contact support.";

/**
 * Returns the self-correction policy for a given error code.
 * Used by the processor to determine retry behavior and user messaging.
 */
export function getGateFailurePolicy(errorCode: string): GateFailurePolicy {
  // S06b — Handoff Gate failures (LLM content quality)
  if (errorCode.startsWith("HANDOFF_")) {
    return {
      max_retries: 1,
      persist_quarantine_artifact: true,
      user_safe_message: USER_SAFE_QUALITY_MESSAGE,
      severity: "high",
    };
  }

  // S07 — Recommendation Integrity Gate
  if (errorCode.startsWith("REC_INTEGRITY_")) {
    return {
      max_retries: 1,
      persist_quarantine_artifact: true,
      user_safe_message: USER_SAFE_QUALITY_MESSAGE,
      severity: "high",
    };
  }

  // S09 — QualityGateV2 (deterministic — retry won't help)
  if (errorCode.startsWith("QG_")) {
    return {
      max_retries: 0,
      persist_quarantine_artifact: true,
      user_safe_message: USER_SAFE_TERMINAL_MESSAGE,
      severity: "critical",
    };
  }

  // S11b — Download Pipeline (deterministic code failures)
  if (errorCode.startsWith("DOWNLOAD_")) {
    return {
      max_retries: 0,
      persist_quarantine_artifact: false,
      user_safe_message: USER_SAFE_TERMINAL_MESSAGE,
      severity: "medium",
    };
  }

  // Default: unknown gate code — fail conservative
  return {
    max_retries: 0,
    persist_quarantine_artifact: false,
    user_safe_message: USER_SAFE_TERMINAL_MESSAGE,
    severity: "medium",
  };
}

// ── Retry Context Builder ────────────────────────────────────────────────────

/**
 * Builds the retry context payload that gets injected into the LLM prompt
 * when a gate fails and the system retries the pass.
 */
export function buildRetryContext(opts: {
  gate: string;
  stageId: string;
  violationCodes: string[];
  affectedFields: string[];
  attemptNumber: number;
}): RetryContext {
  const violationSummary = opts.violationCodes
    .slice(0, 5) // cap to prevent prompt bloat
    .map((code) => describeViolationCode(code))
    .join("; ");

  return {
    failed_gate: opts.gate,
    stage_id: opts.stageId,
    violation_codes: opts.violationCodes,
    affected_fields: opts.affectedFields,
    attempt_number: opts.attemptNumber,
    retry_instruction:
      `Your previous output was rejected by the ${opts.gate} for: ${violationSummary}. ` +
      `Regenerate without these defects. Ensure every rationale ends with terminal punctuation, ` +
      `every recommendation references a specific manuscript passage, and no placeholder or ` +
      `template text remains in the output.`,
  };
}

// ── Violation Code Descriptions ──────────────────────────────────────────────

function describeViolationCode(code: string): string {
  switch (code) {
    case "HANDOFF_SCAFFOLD_RESIDUE":
      return "placeholder/template text found in output";
    case "HANDOFF_INCOMPLETE_SENTENCE":
      return "rationale or action lacks complete sentence structure";
    case "HANDOFF_BROKEN_MODAL":
      return "garbled modal phrase detected (e.g. doubled verbs, broken syntax)";
    case "HANDOFF_GENERIC_LANGUAGE":
      return "generic workshop advice without specific manuscript evidence";
    case "HANDOFF_MISSING_EVIDENCE_ANCHOR":
      return "recommendation lacks manuscript quotation reference";
    case "REC_INTEGRITY_MALFORMED":
      return "malformed recommendation text";
    case "REC_INTEGRITY_GENERIC":
      return "generic recommendation without specificity";
    case "REC_INTEGRITY_NO_EVIDENCE":
      return "recommendation lacks supporting evidence";
    default:
      return code.toLowerCase().replace(/_/g, " ");
  }
}

// ── Quarantine Artifact Helpers ──────────────────────────────────────────────

export type QuarantineArtifact = {
  artifact_type: string;
  gate: string;
  stage_id: string;
  violation_codes: string[];
  attempt_number: number;
  quarantined_at: string;
  content: unknown;
};

/**
 * Builds a quarantine artifact record for persistence.
 * The content is the raw failing output — preserved for admin inspection
 * but NEVER served to the author.
 */
export function buildQuarantineArtifact(opts: {
  gate: string;
  stageId: string;
  violationCodes: string[];
  attemptNumber: number;
  content: unknown;
}): QuarantineArtifact {
  return {
    artifact_type: `quarantine_${opts.stageId.toLowerCase()}`,
    gate: opts.gate,
    stage_id: opts.stageId,
    violation_codes: opts.violationCodes,
    attempt_number: opts.attemptNumber,
    quarantined_at: new Date().toISOString(),
    content: opts.content,
  };
}
