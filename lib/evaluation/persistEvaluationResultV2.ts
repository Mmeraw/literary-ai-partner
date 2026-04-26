import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvaluationResultV2 } from "@/schemas/evaluation-result-v2";
import { JOB_STATUS, type JobStatus } from "@/lib/jobs/types";
import { normalizeEvaluationJobStatus } from "@/lib/evaluation/status";
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

export async function persistEvaluationResultV2(params: {
  supabase: SupabaseClient;
  jobId: string;
  manuscriptId: number;
  evaluationResult: EvaluationResultV2;
  sourceHash: string;
  progressSnapshot: Record<string, unknown>;
  totalUnits: number;
  completedUnits: number;
}): Promise<{ artifactId: string; completedAt: string }> {
  if (!Number.isFinite(params.manuscriptId) || params.manuscriptId <= 0) {
    throw new Error(`Invalid manuscript_id for persistEvaluationResultV2: ${params.manuscriptId}`);
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

  const completionPayloadBase = {
    status: completionStatus,
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

  let { error: updateError } = await params.supabase
    .from("evaluation_jobs")
    .update({
      ...completionPayloadBase,
      phase2_completed_at: completionTime,
    })
    .eq("id", params.jobId);

  if (updateError && isMissingSchemaCacheColumnError(updateError, "phase2_completed_at")) {
    ({ error: updateError } = await params.supabase
      .from("evaluation_jobs")
      .update(completionPayloadBase)
      .eq("id", params.jobId));
  }

  if (updateError) {
    throw new Error(`Completion update failed: ${updateError.message}`);
  }

  return {
    artifactId,
    completedAt: completionTime,
  };
}
