/**
 * SIPOC Forensic View API
 *
 * GET /api/admin/forensics/[jobId]
 *
 * Assembles a complete stage-by-stage forensic trace for a single evaluation job.
 * Data sources:
 *   - evaluation_jobs: job metadata, progress JSON (timeline, failure envelope)
 *   - evaluation_artifacts: artifact types and creation timestamps
 *   - pipeline_logs: structured audit log per stage
 *
 * Response shape:
 *   { job, stages[], artifacts[], logs[], timeline[], canonCompliance[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDevHeaderActor } from "@/lib/auth/devHeaderActor";
import type { FailureDiagnosisV1 } from "@/lib/evaluation/failureDiagnosis";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

// Canonical SIPOC stages in execution order
const SIPOC_STAGES = [
  { id: "intake", label: "Intake", authority: "SIPOC S01" },
  { id: "routing_chunking", label: "Routing & Chunking", authority: "SIPOC S02" },
  { id: "phase_0_5a_seed", label: "Phase 0.5A — Story Map Seed", authority: "SIPOC S03" },
  { id: "phase_0_5b_seed", label: "Phase 0.5B — Editorial Seed", authority: "SIPOC S04" },
  { id: "pass1a_validation", label: "Pass 1A — Seed Guard", authority: "SIPOC S05" },
  { id: "pass1_craft", label: "Pass 1 — Craft Analysis", authority: "SIPOC S06" },
  { id: "pass1_2_handoff", label: "S06b — Handoff Gate", authority: "SIPOC S06b, Volume III §III.PL5, Doctrine #13" },
  { id: "pass2_editorial", label: "Pass 2 — Editorial Synthesis", authority: "SIPOC S07" },
  { id: "pass3_synthesis", label: "Pass 3 — Final Synthesis", authority: "SIPOC S08" },
  { id: "quality_gate", label: "Quality Gate (Pass 4)", authority: "SIPOC S09, Volume III §III.QG" },
  { id: "persistence_report", label: "Persistence & Report", authority: "SIPOC S10" },
  { id: "renderer", label: "Renderer (Webpage/PDF/DOCX/TXT)", authority: "SIPOC S11" },
] as const;

type ArtifactHealthStatus = "valid" | "invalid" | "unknown";

type ForensicArtifactHealth = {
  artifact_type: string;
  artifact_version: string | null;
  created_at: string;
  source_hash: string | null;
  schema_version: string | null;
  status: ArtifactHealthStatus;
  size_bytes: number | null;
  job_id_match: boolean | null;
  manuscript_id_match: boolean | null;
  required_fields_present: boolean;
  missing_fields: string[];
  notes: string | null;
};

type ForensicPacketV1 = {
  artifact_type: "forensic_packet_v1";
  version: 1;
  job_id: string;
  status: string;
  phase: string | null;
  phase_status: string | null;
  failure_code: string | null;
  failure_class: string | null;
  created_at: string;
  updated_at: string;
  repair_count: number | null;
  repair_reason: string | null;
  blocking_artifact: string | null;
  root_cause_hint: string;
  artifact_summary: {
    total: number;
    valid: number;
    invalid: number;
    unknown: number;
  };
  first_artifact_at: string | null;
  last_artifact_at: string | null;
  artifact_lineage: Array<{
    artifact_type: string;
    created_at: string;
    artifact_version: string | null;
    source_hash: string | null;
    status: ArtifactHealthStatus;
    size_bytes: number | null;
    missing_fields: string[];
  }>;
};
type ForensicArtifactQuality = {
  grade: "clean" | "degraded" | "contaminated" | "failed";
  contamination_start_stage: string | null;
  contamination_start_artifact: string | null;
  contamination_reason: string | null;
  clean_artifact_count: number;
  invalid_artifact_count: number;
  unknown_artifact_count: number;
  downstream_salvage_artifact_count: number;
  downstream_salvage_stage_count: number;
  weak_sipoc_stage: string | null;
  notes: string[];
};
type ForensicPacketV2 = {
  artifact_type: "forensic_packet_v2";
  version: 2;
  job_id: string;
  failure_code: string | null;
  failure_class: string | null;
  failure_type: string;
  blocking_artifact: string | null;
  first_contaminated_stage: string | null;
  first_contaminated_artifact: string | null;
  weak_sipoc_stage: string | null;
  repair_attempts: number | null;
  repair_exhausted: boolean;
  salvageable_downstream: boolean;
  downstream_salvage_artifact_count: number;
  downstream_salvage_stage_count: number;
  root_cause_confidence: number;
  structured_diagnostics: {
    missing_fields: string[];
    failed_checks: string[];
    failed_criteria: string[];
    blocking_reasons: string[];
    artifact_counts: {
      total: number;
      valid: number;
      invalid: number;
      unknown: number;
    };
  };
};

type StageResult = "pass" | "inferred_pass" | "fail" | "skip" | "not_reached" | "retry_pass" | "retry_fail";

interface ForensicStage {
  id: string;
  label: string;
  authority: string;
  result: StageResult;
  duration_ms: number | null;
  error_code: string | null;
  error_detail: string | null;
  retry_attempted: boolean;
  retry_succeeded: boolean | null;
  input_summary: string | null;
  output_summary: string | null;
  logs: Array<{
    level: string;
    message: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeForensicText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) return normalized;
  if (normalized.includes(' ')) return '[redacted prose]';
  const isCodeLike = /^[A-Za-z0-9_./:\-()[\]{}=+|]+$/.test(normalized);
  if (isCodeLike && normalized.length <= 180) return normalized;
  return '[redacted prose]';
}

function sanitizeForensicExcerpt(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return '[redacted excerpt]';
}

function sanitizeTimelineEvent(event: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (typeof value === 'string' && ['reason', 'detail', 'message', 'error', 'last_error', 'summary'].includes(key)) {
      sanitized[key] = sanitizeForensicText(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function inferFailureType(input: {
  failureCode: string | null;
  blockingArtifact: string | null;
  failedChecks: string[];
  missingFields: string[];
}): string {
  const code = input.failureCode ?? '';
  if (code === 'HANDOFF_REPAIR_EXHAUSTED') return 'handoff_repair_exhausted';
  if (code === 'QG_FAILED') return 'quality_gate_blocked';
  if (code === 'ARTIFACT_CONSISTENCY_GATE_FAILED') return 'artifact_consistency_blocked';
  if (code === 'TEMPLATE_COMPLETENESS_GATE_FAILED') return 'template_completeness_blocked';
  if (input.missingFields.length > 0) return 'missing_required_fields';
  if (input.failedChecks.length > 0) return 'failed_checks_present';
  if (input.blockingArtifact) return 'blocking_artifact_present';
  return 'unknown';
}

function calculateRootCauseConfidence(input: {
  failureCode: string | null;
  failureClass: string | null;
  blockingArtifact: string | null;
  firstContaminatedStage: string | null;
  firstContaminatedArtifact: string | null;
  failedChecks: string[];
  missingFields: string[];
}): number {
  let score = 40;
  if (input.failureCode) score += 15;
  if (input.failureClass) score += 10;
  if (input.blockingArtifact) score += 10;
  if (input.firstContaminatedStage) score += 10;
  if (input.firstContaminatedArtifact) score += 10;
  if (input.failedChecks.length > 0 || input.missingFields.length > 0) score += 5;
  return Math.min(score, 95);
}

export async function GET(req: NextRequest, context: RouteContext) {
  const actor = getDevHeaderActor(req);
  if (!actor?.isAdmin) {
    const denied = await requireAdmin(req);
    if (denied) return denied;
  }

  try {
    const { jobId } = await context.params;
    const supabase = createAdminClient();

    // Fetch job, artifacts, and pipeline logs in parallel
    const [jobResult, artifactResult, logResult, failureDiagnosisResult] = await Promise.all([
      supabase
        .from("evaluation_jobs")
        .select("id,user_id,manuscript_id,job_type,status,phase,phase_status,progress,total_units,completed_units,failed_units,last_error,failure_code,created_at,updated_at,evaluation_result")
        .eq("id", jobId)
        .maybeSingle(),
      supabase
        .from("evaluation_artifacts")
        .select("id,job_id,manuscript_id,artifact_type,artifact_version,source_hash,created_at,content")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true }),
      supabase
        .from("pipeline_logs")
        .select("id,job_id,level,stage,message,metadata,created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true }),
      supabase
        .from("evaluation_artifacts")
        .select("content")
        .eq("job_id", jobId)
        .eq("artifact_type", "failure_diagnosis_v1")
        .maybeSingle(),
    ]);

    if (jobResult.error) {
      return NextResponse.json(
        { ok: false, error: "Failed to fetch job", details: jobResult.error.message },
        { status: 500 }
      );
    }
    if (!jobResult.data) {
      return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
    }

    const job = jobResult.data as Record<string, unknown>;
    const artifacts = (artifactResult.data ?? []) as Array<{
      id: string;
      job_id: string | null;
      manuscript_id: number | null;
      artifact_type: string;
      artifact_version: string | null;
      source_hash: string | null;
      created_at: string;
      content: unknown | null;
    }>;
    const logs = (logResult.data ?? []) as Array<{
      id: string;
      level: string;
      stage: string | null;
      message: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;
    const failureDiagnosis =
      failureDiagnosisResult.error || !failureDiagnosisResult.data?.content
        ? null
        : (failureDiagnosisResult.data.content as FailureDiagnosisV1);

    // Extract progress data
    const progress = (job.progress ?? {}) as Record<string, unknown>;
    const timeline = (progress.timeline ?? []) as Array<Record<string, unknown>>;
    const failureEnvelope = (progress.pipeline_failure_envelope ?? {}) as Record<string, unknown>;
    const failureDiagnostics = (progress.pipeline_failure_diagnostics ?? {}) as Record<string, unknown>;
    const chunkRouting = (progress.chunk_routing ?? {}) as Record<string, unknown>;
    const selfCorrectionRaw = progress.self_correction;
    const selfCorrectionPolicyDeployed = selfCorrectionRaw !== undefined && selfCorrectionRaw !== null;
    const selfCorrection = (selfCorrectionRaw ?? {}) as Record<string, unknown>;

    const artifactHealth = artifacts.map((artifact) => assessArtifactHealth(artifact, job)).sort(
      (a, b) => a.created_at.localeCompare(b.created_at),
    );

    const artifactSummary = artifactHealth.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.status] += 1;
        return acc;
      },
      { total: 0, valid: 0, invalid: 0, unknown: 0 },
    );

    const repairCount = typeof progress.pass12_handoff_repair_count === 'number'
      ? progress.pass12_handoff_repair_count
      : null;
    const repairReason = typeof progress.pass12_handoff_repair_reason === 'string'
      ? progress.pass12_handoff_repair_reason
      : null;

    const firstArtifactAt = artifactHealth[0]?.created_at ?? null;
    const lastArtifactAt = artifactHealth[artifactHealth.length - 1]?.created_at ?? null;

    const blockingArtifact = failureDiagnosis?.artifact_inventory.first_missing_or_failed_artifact
      ?? artifactHealth.find((item) => item.status === 'invalid')?.artifact_type
      ?? null;

    const forensicPacket: ForensicPacketV1 = {
      artifact_type: 'forensic_packet_v1',
      version: 1,
      job_id: String(job.id),
      status: String(job.status),
      phase: (job.phase as string | null) ?? null,
      phase_status: (job.phase_status as string | null) ?? null,
      failure_code: (job.failure_code as string | null) ?? null,
      failure_class: failureDiagnosis?.failure_class ?? null,
      created_at: String(job.created_at),
      updated_at: String(job.updated_at),
      repair_count: repairCount,
      repair_reason: repairReason,
      blocking_artifact: blockingArtifact,
      root_cause_hint: failureDiagnosis?.admin_summary
        ? sanitizeForensicText(failureDiagnosis.admin_summary)
        : 'Inspect_artifact_health_and_phase_transitions',
      artifact_summary: artifactSummary,
      first_artifact_at: firstArtifactAt,
      last_artifact_at: lastArtifactAt,
      artifact_lineage: artifactHealth.map((item) => ({
        artifact_type: item.artifact_type,
        created_at: item.created_at,
        artifact_version: item.artifact_version,
        source_hash: item.source_hash,
        status: item.status,
        size_bytes: item.size_bytes,
        missing_fields: item.missing_fields,
      })),
    };

    // Determine which stage failed
    const failedStageRaw = (failureEnvelope.pipeline_stage ?? failureEnvelope.failed_at ?? job.phase_status ?? "") as string;

    // Build logs index by stage
    const logsByStage = new Map<string, typeof logs>();
    for (const log of logs) {
      const stage = log.stage ?? "unknown";
      if (!logsByStage.has(stage)) logsByStage.set(stage, []);
      logsByStage.get(stage)!.push(log);
    }

    // Build artifact-based stage evidence
    const artifactReached = getArtifactReachedStages(artifacts);
    const phaseHighwater = getPhaseHighwaterIndex((job.phase as string) ?? "");

    // Build forensic stages
    const stages: ForensicStage[] = SIPOC_STAGES.map((spec, specIdx) => {
      const stageLogs = logsByStage.get(spec.id) ?? [];
      const hasError = stageLogs.some((l) => l.level === "error");
      const stageTimeline = timeline.filter(
        (e) => typeof e.stage === "string" && normalizeStage(e.stage) === spec.id
      );

      // Determine result
      let result: StageResult = "not_reached";
      const isFailedStage = normalizeStage(failedStageRaw) === spec.id;

      if (isFailedStage && job.status === "failed") {
        // Check for retry
        const retryEvents = stageTimeline.filter(
          (e) => typeof e.event === "string" && e.event.includes("retry")
        );
        if (retryEvents.length > 0) {
          const retrySuccess = retryEvents.some(
            (e) => typeof e.result === "string" && e.result === "success"
          );
          result = retrySuccess ? "retry_pass" : "retry_fail";
        } else {
          result = "fail";
        }
      } else if (stageLogs.length > 0 || stageTimeline.length > 0) {
        if (hasError) {
          result = "fail";
        } else {
          result = "pass";
        }
      } else if (job.status === "complete") {
        // If job completed, all stages before the final one passed
        const isRendererOrLater = specIdx >= SIPOC_STAGES.length - 1;
        if (!isRendererOrLater) {
          result = "pass";
        } else {
          const hasWebpage = artifacts.some((a) => a.artifact_type === "evaluation_result_v2");
          result = hasWebpage ? "pass" : "not_reached";
        }
      } else if (job.status === "failed") {
        // For failed jobs: use artifact evidence + phase highwater mark
        // These are "inferred_pass" — artifact proves stage ran but we cannot
        // confirm downstream validation passed (artifact exists ≠ stage fully passed)
        if (artifactReached.has(spec.id)) {
          result = "inferred_pass"; // Artifact proves this stage produced output
        } else if (phaseHighwater >= 0 && specIdx < phaseHighwater) {
          result = "inferred_pass"; // Stage is before the failed phase, so it must have run
        }
      }

      // Duration from timeline events
      let durationMs: number | null = null;
      if (stageTimeline.length >= 2) {
        const first = new Date(stageTimeline[0].timestamp as string).getTime();
        const last = new Date(stageTimeline[stageTimeline.length - 1].timestamp as string).getTime();
        if (!isNaN(first) && !isNaN(last)) {
          durationMs = last - first;
        }
      }

      // Error details
      const errorCode = isFailedStage ? (failureEnvelope.error_code as string ?? null) : null;
      const errorDetail = isFailedStage && typeof job.last_error === 'string'
        ? sanitizeForensicText(job.last_error)
        : null;

      // Retry info
      const retryAttempted = stageTimeline.some(
        (e) => typeof e.event === "string" && e.event.includes("retry")
      );
      const retrySucceeded = retryAttempted
        ? stageTimeline.some(
            (e) => typeof e.event === "string" && e.event.includes("retry") && e.result === "success"
          )
        : null;

      // Input/output summaries from logs metadata
      const inputLog = stageLogs.find((l) => l.message.includes("input") || l.message.includes("enter"));
      const outputLog = stageLogs.find((l) => l.message.includes("output") || l.message.includes("complete"));
      const inputSummary = inputLog?.metadata ? summarizeMetadata(inputLog.metadata) : null;
      const outputSummary = outputLog?.metadata ? summarizeMetadata(outputLog.metadata) : null;

      return {
        id: spec.id,
        label: spec.label,
        authority: spec.authority,
        result,
        duration_ms: durationMs,
        error_code: errorCode,
        error_detail: errorDetail,
        retry_attempted: retryAttempted,
        retry_succeeded: retrySucceeded,
        input_summary: inputSummary,
        output_summary: outputSummary,
        logs: stageLogs.map((l) => ({
          level: l.level,
          message: sanitizeForensicText(l.message),
          metadata: l.metadata,
          created_at: l.created_at,
        })),
      };
    });

    const firstInvalidArtifactIndex = artifactHealth.findIndex((item) => item.status === 'invalid');
    const firstUnknownArtifactIndex = artifactHealth.findIndex((item) => item.status === 'unknown');
    const firstFailedStageIndex = stages.findIndex((stage) => stage.result === 'fail' || stage.result === 'retry_fail');
    const firstFailedStage = firstFailedStageIndex >= 0 ? stages[firstFailedStageIndex] : null;
    const contaminationStartArtifact = firstInvalidArtifactIndex >= 0 ? artifactHealth[firstInvalidArtifactIndex] : null;
    const downstreamSalvageArtifactCount = contaminationStartArtifact
      ? artifactHealth.slice(firstInvalidArtifactIndex + 1).filter((item) => item.status === 'valid').length
      : 0;
    const downstreamSalvageStageCount = firstFailedStageIndex >= 0
      ? stages.slice(firstFailedStageIndex + 1).filter((stage) => stage.result === 'pass' || stage.result === 'inferred_pass' || stage.result === 'retry_pass').length
      : 0;

    const artifactQuality: ForensicArtifactQuality = {
      grade:
        firstFailedStage || firstInvalidArtifactIndex >= 0
          ? 'contaminated'
          : firstUnknownArtifactIndex >= 0
            ? 'degraded'
            : artifactHealth.length > 0
              ? 'clean'
              : 'failed',
      contamination_start_stage: firstFailedStage?.id ?? null,
      contamination_start_artifact: contaminationStartArtifact?.artifact_type ?? null,
      contamination_reason:
        contaminationStartArtifact?.notes
        ?? firstFailedStage?.error_detail
        ?? firstFailedStage?.error_code
        ?? null,
      clean_artifact_count: artifactSummary.valid,
      invalid_artifact_count: artifactSummary.invalid,
      unknown_artifact_count: artifactSummary.unknown,
      downstream_salvage_artifact_count: downstreamSalvageArtifactCount,
      downstream_salvage_stage_count: downstreamSalvageStageCount,
      weak_sipoc_stage: firstFailedStage?.label ?? contaminationStartArtifact?.artifact_type ?? null,
      notes: [
        contaminationStartArtifact
          ? `First invalid artifact: ${contaminationStartArtifact.artifact_type}`
          : 'No invalid artifacts detected.',
        firstFailedStage
          ? `First failed stage: ${firstFailedStage.label}`
          : 'No failed stages detected.',
        downstreamSalvageArtifactCount > 0
          ? `${downstreamSalvageArtifactCount} later artifact(s) remained valid after the first invalid artifact.`
          : 'No downstream artifact salvage after the first invalid artifact.',
        downstreamSalvageStageCount > 0
          ? `${downstreamSalvageStageCount} later stage(s) still passed after the first failed stage.`
          : 'No downstream stage salvage after the first failed stage.',
      ],
    };

    const structuredMissingFields = contaminationStartArtifact?.missing_fields ?? [];
    const failedChecks = failureDiagnosis?.failed_checks ?? [];
    const failedCriteria = failureDiagnosis?.failed_criteria ?? [];
    const blockingReasons = failureDiagnosis?.blocking_reasons ?? [];
    const forensicPacketV2: ForensicPacketV2 = {
      artifact_type: 'forensic_packet_v2',
      version: 2,
      job_id: String(job.id),
      failure_code: (job.failure_code as string | null) ?? null,
      failure_class: failureDiagnosis?.failure_class ?? null,
      failure_type: inferFailureType({
        failureCode: (job.failure_code as string | null) ?? null,
        blockingArtifact,
        failedChecks,
        missingFields: structuredMissingFields,
      }),
      blocking_artifact: blockingArtifact,
      first_contaminated_stage: artifactQuality.contamination_start_stage,
      first_contaminated_artifact: artifactQuality.contamination_start_artifact,
      weak_sipoc_stage: artifactQuality.weak_sipoc_stage,
      repair_attempts: repairCount,
      repair_exhausted: ((job.failure_code as string | null) ?? null) === 'HANDOFF_REPAIR_EXHAUSTED',
      salvageable_downstream: downstreamSalvageArtifactCount > 0 || downstreamSalvageStageCount > 0,
      downstream_salvage_artifact_count: downstreamSalvageArtifactCount,
      downstream_salvage_stage_count: downstreamSalvageStageCount,
      root_cause_confidence: calculateRootCauseConfidence({
        failureCode: (job.failure_code as string | null) ?? null,
        failureClass: failureDiagnosis?.failure_class ?? null,
        blockingArtifact,
        firstContaminatedStage: artifactQuality.contamination_start_stage,
        firstContaminatedArtifact: artifactQuality.contamination_start_artifact,
        failedChecks,
        missingFields: structuredMissingFields,
      }),
      structured_diagnostics: {
        missing_fields: structuredMissingFields,
        failed_checks: failedChecks,
        failed_criteria: failedCriteria,
        blocking_reasons: blockingReasons,
        artifact_counts: artifactSummary,
      },
    };

    // Self-correction summary
    const selfCorrectionSummary = {
      attempts: (selfCorrection.attempts ?? 0) as number,
      successes: (selfCorrection.successes ?? 0) as number,
      failures: (selfCorrection.failures ?? 0) as number,
      quarantined: (selfCorrection.quarantined ?? false) as boolean,
      fail_closed: (selfCorrection.fail_closed ?? false) as boolean,
      violation_codes: (selfCorrection.violation_codes ?? []) as string[],
      affected_stage: (selfCorrection.affected_stage ?? null) as string | null,
      retry_history: (selfCorrection.retry_history ?? []) as Array<{
        stage: string;
        attempt: number;
        violation_code: string;
        result: "success" | "failure";
        timestamp?: string;
      }>,
    };

    // Retry/Quarantine Analytics — aggregate from timeline + self-correction
    const retryEvents = timeline.filter(
      (e) => typeof e.event === "string" && (
        e.event.includes("retry") || e.event.includes("quarantine") || e.event.includes("fail_closed")
      )
    );
    const retryAnalytics = {
      policy_deployed: selfCorrectionPolicyDeployed,
      total_retry_attempts: selfCorrectionSummary.attempts || retryEvents.filter((e) => String(e.event).includes("retry")).length,
      retry_success_count: selfCorrectionSummary.successes || retryEvents.filter((e) => String(e.event).includes("retry") && e.result === "success").length,
      retry_failure_count: selfCorrectionSummary.failures || retryEvents.filter((e) => String(e.event).includes("retry") && e.result === "failure").length,
      quarantine_count: retryEvents.filter((e) => String(e.event).includes("quarantine")).length + (selfCorrectionSummary.quarantined ? 1 : 0),
      fail_closed_count: retryEvents.filter((e) => String(e.event).includes("fail_closed")).length + (selfCorrectionSummary.fail_closed ? 1 : 0),
      top_violation_codes: selfCorrectionSummary.violation_codes,
      affected_stage: selfCorrectionSummary.affected_stage ?? (failedStageRaw ? normalizeStage(failedStageRaw) : null),
      job_failure_code: (job.failure_code ?? null) as string | null,
      retry_events: retryEvents.map((e) => ({
        event: e.event as string,
        stage: (e.stage ?? null) as string | null,
        result: (e.result ?? null) as string | null,
        reason: typeof e.reason === 'string' ? sanitizeForensicText(e.reason) : null,
        timestamp: (e.timestamp ?? null) as string | null,
      })),
    };

    // Quality gate checks (if available)
    const qualityGateChecks = (failureDiagnostics.quality_gate_checks ?? []) as Array<Record<string, unknown>>;

    // ── Contamination Trace ─────────────────────────────────────────────────
    // Per-recommendation lifecycle: created → modified → flagged → quarantined
    // Reads from the evaluation_result_v2 artifact + quality gate diagnostics
    let contaminationTrace: Array<{
      criterion: string;
      index: number;
      action_preview: string;
      source_pass: number | null;
      created_stage: string;
      modified_stage: string | null;
      flagged_by: string | null;
      quarantined: boolean;
      quarantine_reason: string | null;
      integrity_tier: string | null;
      violation_codes: string[];
    }> = [];

    // Fetch the evaluation_result_v2 artifact content
    const { data: evalArtifact } = await supabase
      .from("evaluation_artifacts")
      .select("content")
      .eq("job_id", jobId)
      .eq("artifact_type", "evaluation_result_v2")
      .maybeSingle();

    if (evalArtifact?.content) {
      const evalContent = evalArtifact.content as Record<string, unknown>;
      const criteria = (evalContent.criteria ?? []) as Array<{
        key: string;
        recommendations: Array<{
          action: string;
          source_pass?: number;
          priority?: string;
          anchor_snippet?: string;
          symptom?: string;
          cause?: string;
          mechanism?: string;
          specific_fix?: string;
          fix_direction?: string;
          reader_effect?: string;
          expected_impact?: string;
        }>;
      }>;

      // Get quarantined rec info from quality gate diagnostics
      const qgRecIntegrityCheck = qualityGateChecks.find(
        (c) => (c as Record<string, unknown>).check_id === "rec_integrity"
      ) as Record<string, unknown> | undefined;
      const qgDetails = (qgRecIntegrityCheck?.details ?? "") as string;

      for (const criterion of criteria) {
        for (let i = 0; i < (criterion.recommendations ?? []).length; i++) {
          const rec = criterion.recommendations[i];
          const sourcePass = rec.source_pass ?? null;

          // Determine created stage from source_pass
          let createdStage = "pass3_synthesis";
          if (sourcePass === 1) createdStage = "pass1_craft";
          else if (sourcePass === 2) createdStage = "pass2_editorial";

          // Determine if modified (source pass != 3 means it was originated earlier then merged in Pass 3)
          const modifiedStage = sourcePass && sourcePass < 3 ? "pass3_synthesis" : null;

          // Check if this rec was mentioned in integrity gate details
          const wasFlagged = qgDetails.includes(criterion.key) && qgDetails.includes("FAIL");

          contaminationTrace.push({
            criterion: criterion.key,
            index: i,
            action_preview: rec.action ? "[redacted recommendation]" : "(empty)",
            source_pass: sourcePass,
            created_stage: createdStage,
            modified_stage: modifiedStage,
            flagged_by: wasFlagged ? "Integrity Gate (S09)" : null,
            quarantined: false, // If it's in the result, it survived
            quarantine_reason: null,
            integrity_tier: null, // Would need to re-run gate for per-rec tier
            violation_codes: [],
          });
        }
      }

      // Also fetch pass_outputs_diagnostic for quarantined recs
      const { data: diagArtifact } = await supabase
        .from("evaluation_artifacts")
        .select("content")
        .eq("job_id", jobId)
        .eq("artifact_type", "pass_outputs_diagnostic_v1")
        .maybeSingle();

      if (diagArtifact?.content) {
        const diagContent = diagArtifact.content as Record<string, unknown>;
        const quarantinedRecs = (diagContent.quarantined_recommendations ?? diagContent.filtered_recommendations ?? []) as Array<{
          criterion?: string;
          action?: string;
          reason?: string;
          violation_codes?: string[];
          tier?: string;
        }>;

        for (const qRec of quarantinedRecs) {
          contaminationTrace.push({
            criterion: qRec.criterion ?? "unknown",
            index: -1,
            action_preview: qRec.action ? "[redacted recommendation]" : "(quarantined)",
            source_pass: null,
            created_stage: "pass2_editorial",
            modified_stage: "pass3_synthesis",
            flagged_by: "Integrity Gate (S08/S09)",
            quarantined: true,
            quarantine_reason: qRec.reason ? sanitizeForensicText(qRec.reason) : "FAIL_tier",
            integrity_tier: qRec.tier ?? "FAIL",
            violation_codes: qRec.violation_codes ?? [],
          });
        }
      }
    }

    const sanitizedFailureDiagnosis = failureDiagnosis
      ? {
          ...failureDiagnosis,
          user_safe_summary: sanitizeForensicText(failureDiagnosis.user_safe_summary),
          admin_summary: sanitizeForensicText(failureDiagnosis.admin_summary),
          developer_summary: sanitizeForensicText(failureDiagnosis.developer_summary),
          recommended_next_action: sanitizeForensicText(failureDiagnosis.recommended_next_action),
          blocking_reasons: failureDiagnosis.blocking_reasons.map((reason) => sanitizeForensicText(reason)),
          failed_checks: failureDiagnosis.failed_checks.map((check) => sanitizeForensicText(check)),
          evidence_refs: failureDiagnosis.evidence_refs.map((ref) => ({
            ...ref,
            excerpt: sanitizeForensicExcerpt(ref.excerpt),
          })),
        }
      : null;

    return NextResponse.json({
      ok: true,
      job: {
        id: job.id,
        manuscript_id: job.manuscript_id,
        job_type: job.job_type,
        status: job.status,
        phase: job.phase,
        phase_status: job.phase_status,
        failure_code: job.failure_code,
        last_error: typeof job.last_error === 'string' ? sanitizeForensicText(job.last_error) : job.last_error,
        created_at: job.created_at,
        updated_at: job.updated_at,
        word_count: chunkRouting.word_count ?? null,
        route: chunkRouting.route ?? null,
        chunks: chunkRouting.chunk_count ?? null,
      },
      artifactHealth,
      artifactQuality,
      forensicPacket,
      forensicPacketV2,
      stages,
      artifacts: artifacts.map((a) => ({
        type: a.artifact_type,
        created_at: a.created_at,
      })),
      timeline: timeline.map(sanitizeTimelineEvent),
      selfCorrection: selfCorrectionSummary,
      retryAnalytics,
      qualityGateChecks,
      failureDiagnosis: sanitizedFailureDiagnosis,
      canonCompliance: SIPOC_STAGES.map((spec) => ({
        stage: spec.id,
        authority: spec.authority,
        enforced: stages.find((s) => s.id === spec.id)?.result !== "not_reached",
      })),
      contaminationTrace,
    });
  } catch (err) {
    console.error("[Forensic View] Unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// --- Helpers ---

function normalizeStage(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("0.5a") || s.includes("0_5a") || s.includes("story_map_seed")) return "phase_0_5a_seed";
  if (s.includes("0.5b") || s.includes("0_5b") || s.includes("dream_seed") || s.includes("editorial_seed")) return "phase_0_5b_seed";
  if (s.includes("1a") || s.includes("seed_guard")) return "pass1a_validation";
  if (s.includes("handoff") || s.includes("s06b")) return "pass1_2_handoff";
  if (s.includes("pass1") || s.includes("pass_1") || s.includes("phase_1")) return "pass1_craft";
  if (s.includes("pass2") || s.includes("pass_2") || s.includes("phase_2")) return "pass2_editorial";
  if (s.includes("pass3") || s.includes("pass_3") || s.includes("phase_3")) return "pass3_synthesis";
  if (s.includes("pass4") || s.includes("quality") || s.includes("qg") || s.includes("template_completeness")) return "quality_gate";
  if (s.includes("persist") || s.includes("report") || s.includes("finali")) return "persistence_report";
  if (s.includes("render") || s.includes("download")) return "renderer";
  if (s.includes("routing") || s.includes("chunk")) return "routing_chunking";
  if (s.includes("intake") || s.includes("submit")) return "intake";
  return s;
}

// Map artifact types to the SIPOC stage that produces them
const ARTIFACT_STAGE_MAP: Record<string, string> = {
  story_map_seed_v1: "phase_0_5a_seed",
  evaluation_seed_v1: "phase_0_5b_seed",
  full_context_story_ledger_v1: "pass1a_validation",
  editorial_dream_seed_v1: "phase_0_5b_seed",
  phase1a_chunk_routing_manifest_v1: "pass1a_validation",
  pass1a_chunk_cache_v1: "pass1a_validation",
  seed_contradiction_report_v1: "pass1a_validation",
  pass1a_character_ledger_v1: "pass1a_validation",
  pass1a_story_layer_v1: "pass1a_validation",
  ledger_quality_report_v1: "pass1a_validation",
  accepted_story_ledger_v1: "pass1_craft",
  pass1_chunk_cache_v1: "pass1_craft",
  pass12_handoff_v1: "pass1_2_handoff",
  pass2_chunk_cache_v1: "pass2_editorial",
  pass3_preflight_draft_v1: "pass3_synthesis",
  evaluation_result_v2: "persistence_report",
  pass_outputs_diagnostic_v1: "quality_gate",
  quality_gate_diagnostics_v1: "quality_gate",
  resume_blocked_v1: "quality_gate",
};

// Determine which stages were reached based on artifact evidence
function getArtifactReachedStages(artifacts: Array<{ artifact_type: string }>): Set<string> {
  const reached = new Set<string>();
  for (const a of artifacts) {
    const stage = ARTIFACT_STAGE_MAP[a.artifact_type];
    if (stage) reached.add(stage);
  }
  return reached;
}

// Determine highwater mark from job phase field
function getPhaseHighwaterIndex(phase: string): number {
  const normalized = normalizeStage(phase);
  const idx = SIPOC_STAGES.findIndex((s) => s.id === normalized);
  return idx >= 0 ? idx : -1;
}

function summarizeMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  if (meta.word_count) parts.push(`${meta.word_count} words`);
  if (meta.chunk_count) parts.push(`${meta.chunk_count} chunks`);
  if (meta.criteria_count) parts.push(`${meta.criteria_count} criteria`);
  if (meta.recommendation_count) parts.push(`${meta.recommendation_count} recs`);
  if (meta.score) parts.push(`score: ${meta.score}`);
  if (meta.route) parts.push(`route: ${meta.route}`);
  if (meta.violations) parts.push(`${meta.violations} violations`);
  if (parts.length === 0) {
    const keys = Object.keys(meta).slice(0, 3);
    return keys
      .map((k) => `${k}: ${summarizeMetadataValue(meta[k])}`)
      .join(", ");
  }
  return parts.join(", ");
}

function summarizeMetadataValue(value: unknown): string {
  if (typeof value === 'string') return `${value.length} chars`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  if (isRecord(value)) return `${Object.keys(value).length} keys`;
  return 'present';
}

function assessArtifactHealth(
  artifact: {
    job_id: string | null;
    manuscript_id: number | null;
    artifact_type: string;
    artifact_version: string | null;
    source_hash: string | null;
    created_at: string;
    content: unknown | null;
  },
  job: Record<string, unknown>,
): ForensicArtifactHealth {
  const contentRecord = isRecord(artifact.content) ? artifact.content : null;
  const schemaVersion = typeof contentRecord?.schema_version === 'string' ? contentRecord.schema_version : null;
  const sizeBytes = artifact.content === null || artifact.content === undefined
    ? null
    : new TextEncoder().encode(JSON.stringify(artifact.content)).length;

  const requiredFields = getRequiredFieldsForArtifact(artifact.artifact_type);
  const missingFields = requiredFields.filter((field) => !hasNestedField(contentRecord, field));
  const jobIdMatch = artifact.job_id ? artifact.job_id === String(job.id) : null;
  const manuscriptIdMatch = artifact.manuscript_id && typeof job.manuscript_id === 'number'
    ? artifact.manuscript_id === (job.manuscript_id as number)
    : null;
  const status: ArtifactHealthStatus =
    contentRecord === null
      ? 'unknown'
      : missingFields.length > 0 || jobIdMatch === false || manuscriptIdMatch === false
        ? 'invalid'
        : 'valid';

  const notes =
    status === 'invalid'
      ? missingFields.length > 0
        ? `Missing required fields: ${missingFields.join(', ')}`
        : jobIdMatch === false || manuscriptIdMatch === false
          ? 'Ownership mismatch'
          : 'Validation failed'
      : null;

  return {
    artifact_type: artifact.artifact_type,
    artifact_version: artifact.artifact_version,
    created_at: artifact.created_at,
    source_hash: artifact.source_hash,
    schema_version: schemaVersion,
    status,
    size_bytes: sizeBytes,
    job_id_match: jobIdMatch,
    manuscript_id_match: manuscriptIdMatch,
    required_fields_present: missingFields.length === 0,
    missing_fields: missingFields,
    notes,
  };
}

function getRequiredFieldsForArtifact(artifactType: string): string[] {
  switch (artifactType) {
    case 'pass12_handoff_v1':
      return ['schema_version', 'pass1Output', 'pass2Output'];
    case 'accepted_story_ledger_v1':
      return ['schema_version', 'governance_rail', 'governance_rail.layer_decisions'];
    case 'pass1a_story_layer_v1':
      return ['schema_version'];
    case 'pass1a_character_ledger_v1':
      return ['schema_version'];
    case 'pass3_preflight_draft_v1':
      return ['schema_version'];
    case 'quality_gate_diagnostics_v1':
      return ['failed_checks'];
    case 'artifact_consistency_gate_v1':
      return ['status', 'blocking_reasons', 'checked_invariants'];
    case 'evaluation_result_v2':
      return ['schema_version', 'overview', 'criteria'];
    case 'unified_evaluation_document_v1':
    case 'report_render_manifest_v1':
    case 'author_exposure_certification_v1':
      return ['schema_version'];
    case 'failure_diagnosis_v1':
      return ['artifact_type', 'failure_code', 'failure_class'];
    default:
      return ['schema_version'];
  }
}

function hasNestedField(value: Record<string, unknown> | null, path: string): boolean {
  if (!value) return false;
  const segments = path.split('.');
  let current: unknown = value;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return false;
    }
    current = current[segment];
  }
  return current !== undefined && current !== null;
}
