export type EvaluationIntegrityClass = "PASS" | "HOLD" | "FAIL" | "PROVENANCE" | "WARNING";

export type EvaluationIntegrityBanner = {
  kind: EvaluationIntegrityClass;
  label: string;
  title: string;
  message: string;
  containerClassName: string;
  titleClassName: string;
  warningClassName: string;
  detailClassName: string;
};

type GovernanceWarningSource = {
  governance?: {
    confidence_label?: "high" | "medium" | "low" | "withheld";
    warnings?: string[];
    transparency?: {
      artifact_validation_result?: "PASS" | "HOLD" | "FAIL";
      propagation_summary?: {
        upstream_integrity?: "strong" | "mixed" | "weak";
        authority_level?: "normal" | "constrained" | "blocked";
      };
      [key: string]: unknown;
    };
  };
};

function inferPropagationConstraintFromWarnings(
  warnings: string[],
): "constrained" | "blocked" | null {
  const normalized = warnings.map((warning) => warning.toUpperCase());

  if (
    normalized.some((warning) =>
      warning.includes("CONFIDENCE IS CONSTRAINED BY WEAK UPSTREAM EVIDENCE"),
    )
  ) {
    return "blocked";
  }

  if (
    normalized.some((warning) =>
      warning.includes("CONFIDENCE VARIES ACROSS THIS REPORT"),
    )
  ) {
    return "constrained";
  }

  return null;
}

function inferArtifactValidationResultFromWarnings(
  warnings: string[],
): "PASS" | "HOLD" | "FAIL" | null {
  const normalized = warnings.map((warning) => warning.toUpperCase());

  if (normalized.some((warning) => warning.includes("[ARTIFACTVALIDATION:FAIL]"))) {
    return "FAIL";
  }
  if (normalized.some((warning) => warning.includes("[ARTIFACTVALIDATION:HOLD]"))) {
    return "HOLD";
  }
  if (normalized.some((warning) => warning.includes("[ARTIFACTVALIDATION:PASS]"))) {
    return "PASS";
  }

  return null;
}

function hasProvenanceWarning(warnings: string[]): boolean {
  const normalized = warnings.map((warning) => warning.toUpperCase());
  return normalized.some(
    (warning) =>
      warning.includes("MOCK EVALUATION") ||
      warning.includes("PLACEHOLDER") ||
      warning.includes("NOT REAL AI") ||
      warning.includes("NO OPENAI API KEY"),
  );
}

export function classifyEvaluationIntegrityBanner(
  source: GovernanceWarningSource,
): EvaluationIntegrityBanner | null {
  const warnings = source.governance?.warnings ?? [];
  const hasWarnings = warnings.length > 0;
  const transparencyResult = source.governance?.transparency?.artifact_validation_result ?? null;
  const inferredResult = inferArtifactValidationResultFromWarnings(warnings);
  const gateResult = transparencyResult ?? inferredResult;
  const propagationSummary = source.governance?.transparency?.propagation_summary;
  const inferredConstraint = inferPropagationConstraintFromWarnings(warnings);
  const upstreamIntegrity = propagationSummary?.upstream_integrity;
  const authorityLevel = propagationSummary?.authority_level;

  const constrainedByPropagation =
    upstreamIntegrity === "mixed" ||
    upstreamIntegrity === "weak" ||
    authorityLevel === "constrained" ||
    authorityLevel === "blocked" ||
    source.governance?.confidence_label === "low" ||
    source.governance?.confidence_label === "withheld" ||
    inferredConstraint !== null;

  if (!hasWarnings && !gateResult) {
    return null;
  }

  if (hasProvenanceWarning(warnings)) {
    return {
      kind: "PROVENANCE",
      label: "Evaluation Incomplete",
      title: "⚠️ EVALUATION INCOMPLETE",
      message:
        "This evaluation could not be completed. Please try again to receive a full assessment of your submission.",
      containerClassName: "mt-4 rounded-md border-2 border-red-400 bg-red-50 p-4",
      titleClassName: "text-sm font-bold text-red-900",
      warningClassName: "text-sm font-medium text-red-800",
      detailClassName: "mt-3 text-xs text-red-700",
    };
  }

  if (gateResult === "FAIL") {
    return {
      kind: "FAIL",
      label: "Evaluation Needs Review",
      title: "🛠️ EVALUATION NEEDS REVIEW",
      message:
        "This evaluation could not be fully validated against our quality standards. Review the available feedback with caution.",
      containerClassName: "mt-4 rounded-md border-2 border-red-400 bg-red-50 p-4",
      titleClassName: "text-sm font-bold text-red-900",
      warningClassName: "text-sm font-medium text-red-800",
      detailClassName: "mt-3 text-xs text-red-700",
    };
  }

  if (gateResult === "HOLD") {
    return {
      kind: "HOLD",
      label: "Confidence Varies",
      title: "⚠️ CONFIDENCE VARIES ACROSS THIS REPORT",
      message:
        "Evaluation completed successfully using LiteraryAI-Partner. Some scores and summaries carry lower confidence depending on how much clear text support was available for each story area. Review the confidence indicators beside each score for details.",
      containerClassName: "mt-4 rounded-md border-2 border-amber-400 bg-amber-50 p-4",
      titleClassName: "text-sm font-bold text-amber-900",
      warningClassName: "text-sm font-medium text-amber-800",
      detailClassName: "mt-3 text-xs text-amber-700",
    };
  }

  if (constrainedByPropagation) {
    const isBlocked =
      upstreamIntegrity === "weak" ||
      authorityLevel === "blocked" ||
      source.governance?.confidence_label === "withheld" ||
      inferredConstraint === "blocked";

    return {
      kind: "HOLD",
      label: isBlocked ? "Confidence Constrained" : "Confidence Varies",
      title: isBlocked
        ? "⚠️ CONFIDENCE IS CONSTRAINED"
        : "⚠️ CONFIDENCE VARIES ACROSS THIS REPORT",
      message: isBlocked
        ? "Evaluation completed, but confidence is constrained by weak upstream evidence. Prioritize evidence-backed revisions before acting on high-impact recommendations."
        : "Evaluation completed successfully using LiteraryAI-Partner. Some scores and summaries carry lower confidence depending on how much clear text support was available for each story area. Review the confidence indicators beside each score for details.",
      containerClassName: "mt-4 rounded-md border-2 border-amber-400 bg-amber-50 p-4",
      titleClassName: "text-sm font-bold text-amber-900",
      warningClassName: "text-sm font-medium text-amber-800",
      detailClassName: "mt-3 text-xs text-amber-700",
    };
  }

  if (gateResult === "PASS") {
    return {
      kind: "PASS",
      label: "High Confidence",
      title: "✅ HIGH CONFIDENCE",
      message: "Evaluation completed successfully. Quality checks confirm this evaluation is well-supported by evidence from your text.",
      containerClassName: "mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-4",
      titleClassName: "text-sm font-bold text-emerald-900",
      warningClassName: "text-sm font-medium text-emerald-800",
      detailClassName: "mt-3 text-xs text-emerald-700",
    };
  }

  return {
    kind: "WARNING",
    label: "Evaluation Notice",
    title: "⚠️ EVALUATION WARNING",
    message:
      "Evaluation completed with additional warnings. Review details below before acting on recommendations.",
    containerClassName: "mt-4 rounded-md border-2 border-amber-400 bg-amber-50 p-4",
    titleClassName: "text-sm font-bold text-amber-900",
    warningClassName: "text-sm font-medium text-amber-800",
    detailClassName: "mt-3 text-xs text-amber-700",
  };
}
