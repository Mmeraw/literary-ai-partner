export interface Pass3ReducerTelemetry {
  criteria_count_by_state: {
    agree: number;
    soft_divergence: number;
    hard_divergence: number;
    missing_or_invalid: number;
  };
}

export interface Pass3CriterionOutput {
  key: string;
  final_score_0_10: number;
  final_rationale: string;
}

export interface Pass3OutputLike {
  criteria: Pass3CriterionOutput[];
}

/**
 * Runtime enforcement for Pass 3 synthesis quality.
 * Throws when synthesis collapses into low-information output.
 */
export function enforcePass3QualityGuards(params: {
  telemetry: Pass3ReducerTelemetry;
  output: Pass3OutputLike;
}): void {
  const { telemetry, output } = params;

  if (!Array.isArray(output.criteria) || output.criteria.length === 0) {
    throw new Error("[Pass3][Guard] EMPTY_OUTPUT: No criteria present in Pass 3 output");
  }

  // --- RULE 1: "Confirmed." collapse detection ---
  const trivialCount = output.criteria.filter((c) => {
    const r = String(c.final_rationale ?? "").trim().toLowerCase();
    return r === "confirmed." || r.length < 15;
  }).length;

  const trivialRatio = trivialCount / output.criteria.length;
  if (trivialRatio > 0.5) {
    throw new Error(
      `[Pass3][Guard] TRIVIAL_OUTPUT_COLLAPSE: ${trivialCount}/${output.criteria.length} criteria have trivial rationales`,
    );
  }

  // --- RULE 2: Divergence disappearance (warn-only in initial rollout) ---
  const { soft_divergence, hard_divergence } = telemetry.criteria_count_by_state;
  if (soft_divergence + hard_divergence === 0) {
    console.warn(
      "[Pass3][Guard] DIVERGENCE_COLLAPSE_WARNING: No divergences present — possible over-compression or model flattening",
    );
  }

  // --- RULE 3: Minimum rationale density ---
  const avgLength =
    output.criteria.reduce((sum, c) => sum + String(c.final_rationale ?? "").length, 0) /
    output.criteria.length;

  if (avgLength < 40) {
    throw new Error(
      `[Pass3][Guard] LOW_INFORMATION_OUTPUT: Average rationale length too small (${avgLength.toFixed(1)})`,
    );
  }
}
