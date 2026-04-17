import type { SupabaseClient } from "@supabase/supabase-js";
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";
import {
  type EvaluationResultV2,
  validateEvaluationResultV2,
} from "@/schemas/evaluation-result-v2";
import { upsertEvaluationArtifact } from "./artifactPersistence";

export type EvaluationValidityStatus = "valid" | "invalid" | "disputed";

export type EvaluationFinalizerDecision = {
  validityStatus: EvaluationValidityStatus;
  releaseBlocked: boolean;
  reason: string;
  errors: string[];
};

export type EvaluationFinalizerStageTimestamps = {
  pass1_completed_at?: string;
  pass2_completed_at?: string;
  pass3_completed_at?: string;
};

type FinalizeEvaluationJobParams = {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  evaluationResult: EvaluationResultV2;
  existingProgress: Record<string, unknown>;
  sourceHash: string;
  stageTimestamps?: EvaluationFinalizerStageTimestamps;
  totalUnits: number;
  completedUnitsBeforeFinalize: number;
};

type FinalizeEvaluationJobResult = {
  ok: boolean;
  validityStatus: EvaluationValidityStatus;
  error?: string;
};

function getMinReleaseConfidence(): number {
  const parsed = Number.parseFloat(process.env.EVAL_MIN_RELEASE_CONFIDENCE ?? "0.75");
  if (!Number.isFinite(parsed)) {
    return 0.75;
  }
  return Math.min(1, Math.max(0, parsed));
}

function criterionHasEvidence(result: EvaluationResultV2["criteria"][number]): boolean {
  return result.evidence.some(
    (entry) => typeof entry.snippet === "string" && entry.snippet.trim().length > 0,
  );
}

export function evaluateEvaluationFinalizerDecision(
  evaluationResult: EvaluationResultV2,
  minReleaseConfidence = getMinReleaseConfidence(),
): EvaluationFinalizerDecision {
  const errors: string[] = [];
  const schemaValidation = validateEvaluationResultV2(evaluationResult);

  if (!schemaValidation.valid) {
    errors.push(...schemaValidation.errors);
  }

  if (evaluationResult.criteria.length !== CRITERIA_KEYS.length) {
    errors.push(
      `Expected ${CRITERIA_KEYS.length} criteria, received ${evaluationResult.criteria.length}`,
    );
  }

  for (const criterion of evaluationResult.criteria) {
    if (criterion.status !== "SCORABLE" || criterion.score_0_10 === null) {
      errors.push(
        `Criterion ${criterion.key} is not releasable: status=${criterion.status} score=${String(criterion.score_0_10)}`,
      );
    }

    if (!criterion.rationale || criterion.rationale.trim().length === 0) {
      errors.push(`Criterion ${criterion.key} is missing rationale`);
    }

    if (!criterionHasEvidence(criterion)) {
      errors.push(`Criterion ${criterion.key} is missing evidence`);
    }
  }

  if (evaluationResult.overview.scored_criteria_count !== CRITERIA_KEYS.length) {
    errors.push(
      `Expected scored_criteria_count=${CRITERIA_KEYS.length}, got ${evaluationResult.overview.scored_criteria_count}`,
    );
  }

  if (evaluationResult.overview.overall_score_0_100 === null) {
    errors.push("overall_score_0_100 must be present for canonical release");
  }

  if (errors.length > 0) {
    return {
      validityStatus: "invalid",
      releaseBlocked: true,
      reason: errors.join("; "),
      errors,
    };
  }

  if (evaluationResult.governance.confidence < minReleaseConfidence) {
    const reason =
      `Confidence ${evaluationResult.governance.confidence.toFixed(2)} below release threshold ${minReleaseConfidence.toFixed(2)}`;
    return {
      validityStatus: "disputed",
      releaseBlocked: true,
      reason,
      errors: [reason],
    };
  }

  return {
    validityStatus: "valid",
    releaseBlocked: false,
    reason: "valid",
    errors: [],
  };
}

function structuredFinalizerLog(
  level: "info" | "warn",
  message: string,
  data: Record<string, unknown>,
): void {
  const payload = JSON.stringify({
    service: "evaluation-finalizer",
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data,
  });

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.log(payload);
}

export async function finalizeEvaluationJob(
  params: FinalizeEvaluationJobParams,
): Promise<FinalizeEvaluationJobResult> {
  const decision = evaluateEvaluationFinalizerDecision(params.evaluationResult);
  const finalizedAt = new Date().toISOString();

  if (decision.releaseBlocked) {
    const blockedProgress = {
      ...params.existingProgress,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnitsBeforeFinalize,
      message: "Evaluation blocked by trust gate",
      blocked_at: finalizedAt,
      validity_status: decision.validityStatus,
      validity_errors: decision.errors,
    };

    const { error } = await params.supabase
      .from("evaluation_jobs")
      .update({
        status: "failed",
        phase: "phase_2",
        phase_status: "failed",
        progress: blockedProgress,
        validity_status: decision.validityStatus,
        validity_reason: decision.reason,
        last_error: decision.reason,
        updated_at: finalizedAt,
        ...params.stageTimestamps,
      })
      .eq("id", params.jobId);

    if (error) {
      throw new Error(`Finalizer blocked job write failed: ${error.message}`);
    }

    structuredFinalizerLog("warn", "evaluation release blocked", {
      jobId: params.jobId,
      manuscriptId: params.manuscriptId,
      validityStatus: decision.validityStatus,
      errors: decision.errors,
    });

    return {
      ok: false,
      validityStatus: decision.validityStatus,
      error: decision.reason,
    };
  }

  await upsertEvaluationArtifact({
    supabase: params.supabase,
    jobId: params.jobId,
    manuscriptId: params.manuscriptId,
    artifactType: "evaluation_result_v2",
    content: params.evaluationResult,
    sourceHash: params.sourceHash,
    artifactVersion: "evaluation_result_v2",
  });

  const completedProgress = {
    ...params.existingProgress,
    phase: "phase_2",
    phase_status: "complete",
    total_units: params.totalUnits,
    completed_units: params.totalUnits,
    message: "Evaluation completed",
    finished_at: finalizedAt,
    validity_status: "valid",
  };

  const { error } = await params.supabase
    .from("evaluation_jobs")
    .update({
      status: "complete",
      phase: "phase_2",
      phase_status: "complete",
      total_units: params.totalUnits,
      completed_units: params.totalUnits,
      progress: completedProgress,
      evaluation_result: params.evaluationResult,
      evaluation_result_version: "evaluation_result_v2",
      validity_status: "valid",
      validity_reason: null,
      finalized_at: finalizedAt,
      last_error: null,
      updated_at: finalizedAt,
      ...params.stageTimestamps,
    })
    .eq("id", params.jobId);

  if (error) {
    throw new Error(`Finalizer completion update failed: ${error.message}`);
  }

  structuredFinalizerLog("info", "evaluation released", {
    jobId: params.jobId,
    manuscriptId: params.manuscriptId,
    validityStatus: decision.validityStatus,
  });

  return {
    ok: true,
    validityStatus: "valid",
  };
}