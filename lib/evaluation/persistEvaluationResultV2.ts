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
import { upsertEvaluationArtifact } from "./artifactPersistence";

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

  const artifactId = await upsertEvaluationArtifact({
    supabase: params.supabase,
    jobId: params.jobId,
    manuscriptId: params.manuscriptId,
    artifactType: "evaluation_result_v2",
    content: params.evaluationResult,
    sourceHash: params.sourceHash,
    artifactVersion: "evaluation_result_v2",
  });

  const { data: readBackArtifact, error: readBackError } = await params.supabase
    .from("evaluation_artifacts")
    .select("id")
    .eq("job_id", params.jobId)
    .eq("manuscript_id", params.manuscriptId)
    .eq("artifact_type", "evaluation_result_v2")
    .maybeSingle();

  if (readBackError || !readBackArtifact) {
    throw new Error(
      `Fail-closed: artifact read-back failed after upsert (${readBackError?.message ?? "row not found"})`,
    );
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
  };

  let includePhase2CompletedAt = true;
  let includeValidityStatus = true;
  let updateError: { message?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const payload = {
      ...completionPayloadBase,
      ...(includePhase2CompletedAt ? { phase2_completed_at: completionTime } : {}),
      ...(includeValidityStatus ? {} : { validity_status: undefined }),
    };

    const { error } = await params.supabase
      .from("evaluation_jobs")
      .update(payload)
      .eq("id", params.jobId);

    updateError = error;
    if (!updateError) {
      break;
    }

    let retried = false;

    if (includePhase2CompletedAt && isMissingSchemaCacheColumnError(updateError, "phase2_completed_at")) {
      console.warn("[Eval2Boundary] stale schema cache; retrying completion update without optional phase2_completed_at", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      includePhase2CompletedAt = false;
      retried = true;
    }

    if (includeValidityStatus && isMissingSchemaCacheColumnError(updateError, "validity_status")) {
      console.warn("[Eval2Boundary] stale schema cache; retrying completion update without optional validity_status", {
        job_id: params.jobId,
        manuscript_id: params.manuscriptId,
      });
      includeValidityStatus = false;
      retried = true;
    }

    if (!retried) {
      break;
    }
  }

  if (updateError) {
    throw new Error(`Completion update failed: ${updateError.message}`);
  }

  return {
    persisted: true,
    artifactId,
    completedAt: completionTime,
    gateDecision: "PASS",
    validationResult: validation.result,
    confidence,
  };
}
