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

  // SHORT_FORM_FINAL_SANITY_CHECK — LLM echoes of long-form terms or pipeline labels.
  // Re-synthesis with an explicit prohibition instruction has a reasonable chance of
  // producing clean output; grant exactly 1 retry before failing closed.
  if (
    errorCode === "SHORT_FORM_LONGFORM_ARTIFACT_LEAK" ||
    errorCode === "SHORT_FORM_INTERNAL_PROCESS_LEAK" ||
    errorCode === "SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM" ||
    errorCode === "SHORT_FORM_MIDSENTENCE_TERMINATION" ||
    errorCode === "SHORT_FORM_COPY_DEFECT"
  ) {
    return {
      max_retries: 1,
      persist_quarantine_artifact: true,
      user_safe_message: USER_SAFE_QUALITY_MESSAGE,
      severity: "high",
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
      `every author-facing sentence begins with a capital letter and ends as a complete sentence ` +
      `(never mid-clause on a dangling connective, comma, colon, or open parenthesis), ` +
      `distinct diagnostic fields (fix direction, reader effect) are not fused into one run-on, ` +
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
    case "HANDOFF_MIDSENTENCE_TERMINATION":
      return "author-facing prose ends mid-sentence (dangling connective, comma, colon, or open parenthesis) — every rendered sentence must be complete";
    case "REC_INTEGRITY_LOWERCASE_OPENING":
      return "recommendation/opportunity text opens with a lowercase letter — capitalize the first word";
    case "REC_INTEGRITY_FUSED_FIELDS":
      return "distinct diagnostic fields (fix direction, reader effect) are fused with no sentence boundary between them";
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
    case "SHORT_FORM_LONGFORM_ARTIFACT_LEAK":
      return "output contains long-form tier terms (WAVE / Golden Spine / Phase 5) — regenerate without these words";
    case "SHORT_FORM_INTERNAL_PROCESS_LEAK":
      return "output contains internal pipeline stage labels (Pass N / Phase N) — regenerate without pipeline terminology";
    case "SHORT_FORM_UNSUPPORTED_GLOBAL_CLAIM":
      return "output makes whole-manuscript scope claims not supported by the submitted excerpt — scope all claims to the submitted text only";
    case "SHORT_FORM_MIDSENTENCE_TERMINATION":
      return "a diagnostic segment ends mid-sentence (dangling connective, comma, colon, or open parenthesis) — every author-facing sentence must be complete";
    case "SHORT_FORM_COPY_DEFECT":
      return "a diagnostic segment has a copy defect (lowercase opening or accidental adjacent-duplicate word) — capitalize the first word and remove the duplicate";
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
