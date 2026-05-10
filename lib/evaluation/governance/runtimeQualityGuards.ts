export interface Pass3ReducerTelemetry {
  criteria_count_by_state: {
    agree: number;
    soft_divergence: number;
    hard_divergence: number;
    missing_or_invalid: number;
  };
}

export type CompressionGovernanceState = 'pass' | 'warn' | 'observe' | null;

export interface CompressionGovernanceResult {
  state: CompressionGovernanceState;
  ratio: number | null;
  band_label: string;
  log_level: 'silent' | 'warn' | 'observe';
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

/**
 * Phase 1 seed-band divergence-collapse governance classifier.
 *
 * Bands (long-form only):
 *   ratio >= 0.10  → 'pass'    (silent)
 *   0.05 <= ratio < 0.10 → 'warn'    (console.warn)
 *   ratio < 0.05   → 'observe' (console.info telemetry, no fail-closed)
 *
 * Short-form: state = null (bypasses long-form-specific bands).
 *
 * Phase 1 is observation-only. NO 'hard_fail' state emitted under any input.
 * Phase 2 promotion (observe → hard_fail) requires the four prerequisites
 * documented in PR_293_PHASE_2_PREVIEW_BRIEF.md.
 */
export function classifyCompressionGovernance(
  telemetry: { representation_compression_ratio: number | null | undefined; packet_source: string },
): CompressionGovernanceResult {
  const ratio = telemetry.representation_compression_ratio;
  const isLongForm = telemetry.packet_source === 'long_form_chunks_canonical';

  if (!isLongForm || ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return {
      state: null,
      ratio: ratio ?? null,
      band_label: 'short_form_or_null',
      log_level: 'silent',
    };
  }

  if (ratio >= 0.1) {
    return {
      state: 'pass',
      ratio,
      band_label: 'pass_band_>=0.10',
      log_level: 'silent',
    };
  }

  if (ratio >= 0.05) {
    return {
      state: 'warn',
      ratio,
      band_label: 'warn_band_0.05-0.10',
      log_level: 'warn',
    };
  }

  return {
    state: 'observe',
    ratio,
    band_label: 'observe_band_<0.05',
    log_level: 'observe',
  };
}

/**
 * Emit the appropriate log signal for Phase 1 observation.
 * Replaces the existing binary DIVERGENCE_COLLAPSE_WARNING.
 */
export function emitCompressionGovernanceSignal(
  result: CompressionGovernanceResult,
  context: { jobId: string; chunkCount: number },
): void {
  if (result.log_level === 'silent') return;

  const payload = {
    governance: 'Pass3CompressionGuard',
    state: result.state,
    band: result.band_label,
    ratio: result.ratio,
    job_id: context.jobId,
    chunk_count: context.chunkCount,
    phase: 1,
    note: 'Phase 1 observation-only; no fail-closed enforcement until Phase 2 calibration.',
  };

  if (result.log_level === 'warn') {
    console.warn('Pass3CompressionGuard:WARN', payload);
  } else {
    console.info('Pass3CompressionGuard:OBSERVE', payload);
  }
}

/**
 * @deprecated Use classifyCompressionGovernance instead.
 * Retained for transitional callers; will be removed in a follow-up cleanup PR
 * once no live call sites remain.
 */
export function checkDivergenceCollapseWarning(telemetry: {
  criteria_count_by_state: { soft_divergence: number; hard_divergence: number };
}): { warn: boolean } {
  const { soft_divergence, hard_divergence } = telemetry.criteria_count_by_state;
  return { warn: soft_divergence + hard_divergence === 0 };
}
