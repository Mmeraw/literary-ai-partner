import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { JOB_STATUS, type JobStatus } from "@/lib/jobs/types";
import {
  normalizeEvaluationJobStatus,
  normalizeEvaluationValidityStatus,
} from "@/lib/evaluation/status";
import { validateEvaluationArtifact as validateStructuralArtifact } from "@/lib/evaluation/validateEvaluationArtifact";
import { deriveConfidence, type ConfidenceResult } from "@/lib/governance/confidenceDerivation";
import { buildExcellenceFilter } from "@/lib/evaluation/pipeline/buildExcellenceFilter";
import { buildScoreLedger } from "@/lib/evaluation/pipeline/buildScoreLedger";
import type { ArtifactGateResult, ArtifactValidationSummary, EvaluationArtifact } from "@/lib/evaluation/pipeline/types";
import { validateEvaluationArtifact } from "@/lib/evaluation/pipeline/validateEvaluationArtifact";
import { EVALUATION_ARTIFACT_VALIDATION_FAILED } from "@/lib/evaluation/pipeline/failures";

type PipelineFailureEnvelope = {
  failure_origin: string;
  error_code: string;
  error_message: string;
  reason_codes: string[];
  failed_at: string;
  pipeline_stage: string;
};

function isMissingSchemaCacheColumnError(error: unknown, columnName: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";

  return code === "PGRST204" && message.includes(columnName) && message.includes("schema cache");
}

type BoundaryGateDecision = {
  decision: "PASS" | "FAIL";
  result: ArtifactGateResult;
  reason: string;
};

export type PersistEvaluationResultV2Result =
  | {
      persisted: true;
      artifactId: string;
      completedAt: string;
      gateDecision: "PASS";
      validationResult: ArtifactGateResult;
      confidence: ConfidenceResult;
    }
  | {
      persisted: false;
      completedAt: string;
      gateDecision: "FAIL";
      validationResult: ArtifactGateResult;
      confidence: ConfidenceResult;
      reason: string;
    };

type PropagationSummary =
  NonNullable<
    NonNullable<
      NonNullable<EvaluationResultV2["governance"]["transparency"]>["propagation_summary"]
    >
  >;

function readPropagationSummary(
  evaluationResult: EvaluationResultV2,
): PropagationSummary | undefined {
  return evaluationResult.governance?.transparency?.propagation_summary;
}

function buildArtifactForValidation(evaluationResult: EvaluationResultV2): EvaluationArtifact {
  const criteria = evaluationResult.criteria.map((criterion) => ({
    key: criterion.key,
    final_score_0_10: typeof criterion.score_0_10 === "number" ? criterion.score_0_10 : 0,
    reasoning: criterion.rationale,
    evidence: criterion.evidence.map((item) => `"${item.snippet}"`).join(" | "),
    interpretation: criterion.rationale,
  }));

  const ledger = buildScoreLedger({
    criteria: criteria.map((criterion) => ({
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  const efg = buildExcellenceFilter({
    criteria: criteria.map((criterion) => ({
      key: criterion.key,
      final_score_0_10: criterion.final_score_0_10,
    })),
  });

  return {
    criteria,
    ledger,
    efg,
  };
}

function evaluateQualityGate(validation: ArtifactValidationSummary): BoundaryGateDecision {
  if (validation.result === "PASS") {
    return {
      decision: "PASS",
      result: validation.result,
      reason: "Artifact validation result is PASS",
    };
  }

  return {
    decision: "FAIL",
    result: validation.result,
    reason: `Artifact validation result is ${validation.result}`,
  };
}

function deriveBoundaryConfidence(validation: ArtifactValidationSummary, gate: BoundaryGateDecision): ConfidenceResult {
  const reasonCodeSet = new Set(validation.reasonCodes);
  const criterionCompletenessPassed =
    !reasonCodeSet.has("CRIT-MISSING-ALL") && !reasonCodeSet.has("CRIT-MISSING-1");
  const anchorIntegrityPassed = !reasonCodeSet.has("EVIDENCE-MISSING-1");

  return deriveConfidence({
    criterionCompletenessPassed,
    anchorIntegrityPassed,
    governancePassed: gate.decision === "PASS",
    passConvergencePassed: gate.decision === "PASS",
    hasMaterialPassDisagreement: false,
    pass1UnresolvedWarningCount: 0,
    usedFallbackPath: false,
    executionDegraded: false,
    invalidOutput: gate.decision !== "PASS",
    quarantinedOutput: false,
    evidenceCoverage: reasonCodeSet.has("EVIDENCE-MISSING-1") ? "thin" : "strong",
  });
}

export async function persistEvaluationResultV2(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  evaluationResult: EvaluationResultV2;
  sourceHash: string;
  progressSnapshot: Record<string, unknown>;
  totalUnits: number;
  completedUnits: number;
}): Promise<PersistEvaluationResultV2Result> {
  if (!Number.isFinite(params.manuscriptId) || params.manuscriptId <= 0) {
    throw new Error(`Invalid manuscript_id for persistEvaluationResultV2: ${params.manuscriptId}`);
  }

  const structuralValidation = validateStructuralArtifact(params.evaluationResult);
  if (!structuralValidation.ok) {
    const rejectedAt = new Date().toISOString();
    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    const invalidValidity = normalizeEvaluationValidityStatus("invalid");

    const confidence = deriveConfidence({
      criterionCompletenessPassed: false,
      anchorIntegrityPassed: false,
      governancePassed: false,
      passConvergencePassed: false,
      hasMaterialPassDisagreement: false,
      pass1UnresolvedWarningCount: 0,
      usedFallbackPath: false,
      executionDegraded: true,
      invalidOutput: true,
      quarantinedOutput: false,
      evidenceCoverage: "thin",
    });

    const issueCodes = structuralValidation.issues.map((issue) => issue.code);
    const failureMessage =
      `[Eval2BoundaryValidation] Artifact failed structural validation; ` +
      `issue_codes=${issueCodes.join(",") || "none"}`;

    const gateTrace = {
      validation_result: "FAIL",
      reason_codes: issueCodes,
      validated_at: rejectedAt,
      gate_decision: "FAIL",
      gate_reason: "Boundary structural validation failed",
      confidence,
      propagation: readPropagationSummary(params.evaluationResult),
      validation_issues: structuralValidation.issues,
    };

    const failurePayloadBase = {
      status: failedStatus,
      validity_status: invalidValidity,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress: {
        ...params.progressSnapshot,
        finalized_at: rejectedAt,
        phase: "phase_2",
        phase_status: "failed",
        total_units: params.totalUnits,
        completed_units: params.completedUnits,
        message: "Evaluation rejected by boundary structural validator",
        finished_at: rejectedAt,
        gate_enforcement: gateTrace,
      },
      last_error: failureMessage,
      failure_code: EVALUATION_ARTIFACT_VALIDATION_FAILED,
      last_heartbeat: rejectedAt,
      last_heartbeat_at: rejectedAt,
      heartbeat_at: rejectedAt,
      failed_at: rejectedAt,
      updated_at: rejectedAt,
    };

    let { error: failureUpdateError } = await params.supabase
      .from("evaluation_jobs")
      .update(failurePayloadBase)
      .eq("id", params.jobId);

    if (failureUpdateError && isMissingSchemaCacheColumnError(failureUpdateError, "validity_status")) {
      console.warn("[Eval2Boundary] stale schema cache; retrying structural validation rejection update without optional validity_status", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      ({ error: failureUpdateError } = await params.supabase
        .from("evaluation_jobs")
        .update({
          ...failurePayloadBase,
          validity_status: undefined,
        })
        .eq("id", params.jobId));
    }

    if (failureUpdateError) {
      throw new Error(`Structural validation rejection update failed: ${failureUpdateError.message}`);
    }

    return {
      persisted: false,
      completedAt: rejectedAt,
      gateDecision: "FAIL",
      validationResult: "FAIL",
      confidence,
      reason: failureMessage,
    };
  }

  const artifactForValidation = buildArtifactForValidation(params.evaluationResult);
  const validation = validateEvaluationArtifact(artifactForValidation, { mode: "enforce" });
  const gate = evaluateQualityGate(validation);
  const confidence = deriveBoundaryConfidence(validation, gate);

  if (gate.decision !== "PASS") {
    const gateRejectedAt = new Date().toISOString();
    const failedStatus = normalizeEvaluationJobStatus(JOB_STATUS.FAILED) as JobStatus;
    const invalidValidity = normalizeEvaluationValidityStatus("invalid");
    const gateFailureMessage =
      `[Eval2BoundaryGate] ${gate.reason}; reason_codes=${validation.reasonCodes.join(",") || "none"}`;

    const gateTrace = {
      validation_result: validation.result,
      reason_codes: validation.reasonCodes,
      validated_at: validation.validatedAt,
      gate_decision: gate.decision,
      gate_reason: gate.reason,
      confidence,
      propagation: readPropagationSummary(params.evaluationResult),
    };

    const failurePayloadBase = {
      status: failedStatus,
      validity_status: invalidValidity,
      phase: "phase_2",
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress: {
        ...params.progressSnapshot,
        finalized_at: gateRejectedAt,
        phase: "phase_2",
        phase_status: "failed",
        total_units: params.totalUnits,
        completed_units: params.completedUnits,
        message: "Evaluation rejected by boundary quality gate",
        finished_at: gateRejectedAt,
        gate_enforcement: gateTrace,
      },
      last_error: gateFailureMessage,
      failure_code: "EVALUATION_GATE_REJECTED",
      last_heartbeat: gateRejectedAt,
      last_heartbeat_at: gateRejectedAt,
      heartbeat_at: gateRejectedAt,
      failed_at: gateRejectedAt,
      updated_at: gateRejectedAt,
    };

    let { error: failureUpdateError } = await params.supabase
      .from("evaluation_jobs")
      .update(failurePayloadBase)
      .eq("id", params.jobId);

    if (failureUpdateError && isMissingSchemaCacheColumnError(failureUpdateError, "validity_status")) {
      console.warn("[Eval2Boundary] stale schema cache; retrying gate rejection update without optional validity_status", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      ({ error: failureUpdateError } = await params.supabase
        .from("evaluation_jobs")
        .update({
          ...failurePayloadBase,
          validity_status: undefined,
        })
        .eq("id", params.jobId));
    }

    if (failureUpdateError) {
      throw new Error(`Gate rejection update failed: ${failureUpdateError.message}`);
    }

    console.warn("[Eval2Boundary] gate_rejected", {
      job_id: params.jobId,
      manuscript_id: params.manuscriptId,
      validation_result: validation.result,
      reason_codes: validation.reasonCodes,
      validated_at: validation.validatedAt,
      gate_decision: gate.decision,
      confidence,
    });

    return {
      persisted: false,
      completedAt: gateRejectedAt,
      gateDecision: "FAIL",
      validationResult: validation.result,
      confidence,
      reason: gateFailureMessage,
    };
  }

  const completionTime = new Date().toISOString();
  const completionStatus = normalizeEvaluationJobStatus(JOB_STATUS.COMPLETE) as JobStatus;
  const validValidity = normalizeEvaluationValidityStatus("valid");

  const gateTrace = {
    validation_result: validation.result,
    reason_codes: validation.reasonCodes,
    validated_at: validation.validatedAt,
    gate_decision: gate.decision,
    gate_reason: gate.reason,
    confidence,
    propagation: readPropagationSummary(params.evaluationResult),
  };

  const completionPayloadBase = {
    status: completionStatus,
    validity_status: validValidity,
    phase: "phase_2",
    phase_status: "complete",
    total_units: params.totalUnits,
    completed_units: params.completedUnits,
    progress: {
      ...params.progressSnapshot,
      finalized_at: completionTime,
      phase: "phase_2",
      phase_status: "complete",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      message: "Evaluation completed",
      finished_at: completionTime,
      gate_enforcement: gateTrace,
    },
    evaluation_result: params.evaluationResult,
    evaluation_result_version: "evaluation_result_v2",
    last_heartbeat: completionTime,
    last_heartbeat_at: completionTime,
    heartbeat_at: completionTime,
    last_error: null,
    updated_at: completionTime,
    completed_at: completionTime,
    phase2_completed_at: completionTime,
  };

  const { data: atomicRows, error: atomicError } = await params.supabase.rpc(
    "persist_evaluation_v2_atomic",
    {
      p_job_id: params.jobId,
      p_manuscript_id: params.manuscriptId,
      p_artifact_type: "evaluation_result_v2",
      p_artifact_content: params.evaluationResult,
      p_source_hash: params.sourceHash,
      p_artifact_version: "evaluation_result_v2",
      p_evaluation_result: params.evaluationResult,
      p_progress: completionPayloadBase.progress,
      p_completed_at: completionTime,
      p_phase2_completed_at: completionTime,
      p_validity_status: validValidity,
      p_total_units: params.totalUnits,
      p_completed_units: params.completedUnits,
      p_last_heartbeat: completionTime,
      p_last_heartbeat_at: completionTime,
      p_heartbeat_at: completionTime,
    },
  );

  if (atomicError) {
    throw new Error(`Atomic persistence failed: ${atomicError.message}`);
  }

  const atomicRow = Array.isArray(atomicRows) ? atomicRows[0] : undefined;
  if (!atomicRow || typeof atomicRow.artifact_id !== "string" || atomicRow.artifact_id.length === 0) {
    throw new Error("Atomic persistence returned no artifact_id");
  }

  return {
    persisted: true,
    artifactId: atomicRow.artifact_id,
    completedAt: completionTime,
    gateDecision: "PASS",
    validationResult: validation.result,
    confidence,
  };
}

export type FinalizeEvaluationFailureInput = {
  supabase: SupabaseClient;
  jobId: string;
  failureEnvelope: PipelineFailureEnvelope;
  lastError: string;
  failureCode?: string;
  phase: "phase_1" | "phase_2";
  totalUnits: number;
  completedUnits: number;
};

export type FinalizeEvaluationFailureOutput = {
  finalized: true;
  jobId: string;
  failureCode: string;
};

export async function finalizeEvaluationFailure(
  params: FinalizeEvaluationFailureInput,
): Promise<FinalizeEvaluationFailureOutput> {
  const now = new Date().toISOString();
  const failureCode = params.failureCode ?? params.failureEnvelope.error_code;

  const { data: existingJob, error: readError } = await params.supabase
    .from("evaluation_jobs")
    .select("progress, phase")
    .eq("id", params.jobId)
    .single();

  if (readError) {
    throw new Error(
      `[finalizeEvaluationFailure] read failed for job ${params.jobId}: ${readError.message}`,
    );
  }

  const existingProgress =
    existingJob?.progress && typeof existingJob.progress === "object"
      ? (existingJob.progress as Record<string, unknown>)
      : {};
  const existingPhase =
    typeof existingJob?.phase === "string" && existingJob.phase.length > 0
      ? existingJob.phase
      : params.phase;

  const progress = {
    ...existingProgress,
    phase: existingPhase,
    phase_status: "failed",
    total_units: params.totalUnits,
    completed_units: params.completedUnits,
    message: "Evaluation failed",
    failed_at: now,
    pipeline_failure_envelope: params.failureEnvelope,
  };

  const { error: updateError } = await params.supabase
    .from("evaluation_jobs")
    .update({
      status: normalizeEvaluationJobStatus(JOB_STATUS.FAILED),
      phase: existingPhase,
      phase_status: "failed",
      total_units: params.totalUnits,
      completed_units: params.completedUnits,
      progress,
      last_error: params.lastError,
      failure_code: failureCode,
      updated_at: now,
      failed_at: now,
    })
    .eq("id", params.jobId);

  if (updateError) {
    throw new Error(
      `[finalizeEvaluationFailure] update failed for job ${params.jobId}: ${updateError.message}`,
    );
  }

  return {
    finalized: true,
    jobId: params.jobId,
    failureCode,
  };
}
