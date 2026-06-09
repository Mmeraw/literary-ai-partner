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
    const [jobResult, artifactResult, logResult] = await Promise.all([
      supabase
        .from("evaluation_jobs")
        .select("id,user_id,manuscript_id,job_type,status,phase,phase_status,progress,total_units,completed_units,failed_units,last_error,failure_code,created_at,updated_at,evaluation_result")
        .eq("id", jobId)
        .maybeSingle(),
      supabase
        .from("evaluation_artifacts")
        .select("id,job_id,artifact_type,created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true }),
      supabase
        .from("pipeline_logs")
        .select("id,job_id,level,stage,message,metadata,created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true }),
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
    const artifacts = (artifactResult.data ?? []) as Array<{ id: string; artifact_type: string; created_at: string }>;
    const logs = (logResult.data ?? []) as Array<{
      id: string;
      level: string;
      stage: string | null;
      message: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>;

    // Extract progress data
    const progress = (job.progress ?? {}) as Record<string, unknown>;
    const timeline = (progress.timeline ?? []) as Array<Record<string, unknown>>;
    const failureEnvelope = (progress.pipeline_failure_envelope ?? {}) as Record<string, unknown>;
    const failureDiagnostics = (progress.pipeline_failure_diagnostics ?? {}) as Record<string, unknown>;
    const chunkRouting = (progress.chunk_routing ?? {}) as Record<string, unknown>;
    const selfCorrection = (progress.self_correction ?? {}) as Record<string, unknown>;

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
      const errorDetail = isFailedStage ? (job.last_error as string ?? null) : null;

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
          message: l.message,
          metadata: l.metadata,
          created_at: l.created_at,
        })),
      };
    });

    // Self-correction summary
    const selfCorrectionSummary = {
      attempts: (selfCorrection.attempts ?? 0) as number,
      successes: (selfCorrection.successes ?? 0) as number,
      failures: (selfCorrection.failures ?? 0) as number,
      quarantined: (selfCorrection.quarantined ?? false) as boolean,
      fail_closed: (selfCorrection.fail_closed ?? false) as boolean,
      violation_codes: (selfCorrection.violation_codes ?? []) as string[],
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
            action_preview: rec.action?.substring(0, 100) ?? "(empty)",
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
            action_preview: qRec.action?.substring(0, 100) ?? "(quarantined)",
            source_pass: null,
            created_stage: "pass2_editorial",
            modified_stage: "pass3_synthesis",
            flagged_by: "Integrity Gate (S08/S09)",
            quarantined: true,
            quarantine_reason: qRec.reason ?? "FAIL tier",
            integrity_tier: qRec.tier ?? "FAIL",
            violation_codes: qRec.violation_codes ?? [],
          });
        }
      }
    }

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
        last_error: job.last_error,
        created_at: job.created_at,
        updated_at: job.updated_at,
        word_count: chunkRouting.word_count ?? null,
        route: chunkRouting.route ?? null,
        chunks: chunkRouting.chunk_count ?? null,
      },
      stages,
      artifacts: artifacts.map((a) => ({
        type: a.artifact_type,
        created_at: a.created_at,
      })),
      timeline,
      selfCorrection: selfCorrectionSummary,
      qualityGateChecks,
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
    return keys.map((k) => `${k}: ${JSON.stringify(meta[k]).slice(0, 30)}`).join(", ");
  }
  return parts.join(", ");
}
