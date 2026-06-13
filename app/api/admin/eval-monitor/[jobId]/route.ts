import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ jobId: string }> };

type EvalMonitorJobRow = {
  id: string;
  status: string | null;
  phase: string | null;
  phase_status: string | null;
  manuscript_id: string | null;
  manuscript_word_count: number | null;
  work_type: string | null;
  english_variant: string | null;
  total_units: number | null;
  completed_units: number | null;
  failed_units: number | null;
  attempt_count: number | null;
  max_attempts: number | null;
  retry_count: number | null;
  next_attempt_at: string | null;
  last_error: string | null;
  failure_code: string | null;
  lease_until: string | null;
  heartbeat_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  phase0_started_at: string | null;
  phase0_completed_at: string | null;
  phase1_started_at: string | null;
  phase1_completed_at: string | null;
  phase2_started_at: string | null;
  phase2_completed_at: string | null;
  phase3_started_at: string | null;
  phase3_completed_at: string | null;
  progress: unknown;
};

// Artifact types we expose content for (quality-relevant, non-PII)
const CONTENT_ARTIFACT_TYPES = new Set([
  "story_map_seed_v1",
  "evaluation_seed_v1",
  "full_context_story_ledger_v1",
  "phase1a_chunk_routing_manifest_v1",
  "pass3_preflight_draft_v1",
  "seed_contradiction_report_v1",
  "pass1a_character_ledger_v1",
  "pass1a_story_layer_v1",
  "ledger_quality_report_v1",
  "failure_diagnosis_v1",
  "pass1a_chunk_cache_v1",
  "evaluation_result_v2",
  "evaluation_result_v1",
  "quality_gate_result_v1",
]);

export async function GET(req: NextRequest, context: RouteContext) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { jobId } = await context.params;
  if (!jobId || jobId.length < 10) {
    return NextResponse.json({ ok: false, error: "Invalid jobId" }, { status: 400 });
  }

  const sb = createAdminClient();

  const [jobRes, artifactRes] = await Promise.all([
    sb
      .from("evaluation_jobs")
      .select(
        "id,user_id,manuscript_id,manuscript_word_count,job_type,status,phase,phase_status," +
        "progress,total_units,completed_units,failed_units,last_error,failure_code," +
        "failure_envelope,attempt_count,max_attempts,next_attempt_at,retry_count," +
        "created_at,updated_at,started_at,completed_at,failed_at," +
        "phase0_started_at,phase0_completed_at,phase1_started_at,phase1_completed_at," +
        "phase2_started_at,phase2_completed_at,phase3_started_at,phase3_completed_at," +
        "lease_until,heartbeat_at,phase_status,work_type,english_variant"
      )
      .eq("id", jobId)
      .maybeSingle(),
    sb
      .from("evaluation_artifacts")
      .select("id,artifact_type,created_at,content")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true }),
  ]);

  if (jobRes.error) {
    return NextResponse.json({ ok: false, error: jobRes.error.message }, { status: 500 });
  }
  if (!jobRes.data) {
    return NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
  }

  const job = jobRes.data as unknown as EvalMonitorJobRow;
  const allArtifacts = artifactRes.data ?? [];

  // Build artifact summaries — include key quality fields, never full prose
  const artifacts = allArtifacts.map((a) => {
    const base = {
      id: a.id,
      artifact_type: a.artifact_type,
      created_at: a.created_at,
      present: true,
    };

    if (!CONTENT_ARTIFACT_TYPES.has(a.artifact_type) || !a.content) return base;

    const c = a.content as Record<string, unknown>;

    if (a.artifact_type === "pass3_preflight_draft_v1") {
      const drafts = (c.criterionDrafts as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        summary: {
          reducer_status: c.reducer_status,
          criterion_count: drafts.length,
          scores: drafts.map((d) => ({
            criterion: d.criterion,
            score: d.provisionalScore,
            confidence: d.confidence,
            status: d.findingStatus,
          })),
        },
      };
    }

    if (a.artifact_type === "ledger_quality_report_v1") {
      const qr = (c.quality_report as Record<string, unknown>) ?? {};
      return {
        ...base,
        summary: {
          gate_ready_status: qr.gate_ready_status,
          hard_fail_present: qr.hard_fail_present,
          blocking_reasons: qr.blocking_reasons,
          layer_truth_status: qr.layer_truth_status,
          repair_notes: (qr.repair_notes as unknown[])?.slice(0, 5),
        },
      };
    }

    if (a.artifact_type === "failure_diagnosis_v1") {
      return {
        ...base,
        summary: {
          failure_code: c.failure_code,
          phase_status: c.phase_status,
          admin_summary: c.admin_summary,
          failed_checks: c.failed_checks,
          remediation: c.remediation,
        },
      };
    }

    if (a.artifact_type === "seed_contradiction_report_v1") {
      const entities = (c.seed_entities as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        summary: {
          verdict: c.verdict,
          drift_ratio: c.drift_ratio,
          missed_count: c.missed_count,
          missed_entities: entities.filter((e) => e.status === "missed"),
          confirmed_count: entities.filter((e) => e.status === "confirmed").length,
        },
      };
    }

    if (a.artifact_type === "pass1a_story_layer_v1") {
      const layers = (c.layers as Record<string, Record<string, unknown>>) ?? {};
      return {
        ...base,
        summary: {
          layers: Object.fromEntries(
            Object.entries(layers).map(([k, v]) => {
              const h = (v.health as Record<string, unknown>) ?? {};
              return [k, { status: h.status, truth_status: h.truth_status }];
            })
          ),
        },
      };
    }

    if (a.artifact_type === "pass1a_character_ledger_v1") {
      const entries = (c.entries as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        summary: {
          entry_count: entries.length,
          protagonists: entries
            .filter((e) => e.role === "protagonist")
            .map((e) => (e.aliases as string[])?.[0] ?? "unknown"),
          hard_fail_triggers: (c.coverage_summary as Record<string, unknown>)?.hard_fail_triggers ?? [],
        },
      };
    }

    if (a.artifact_type === "full_context_story_ledger_v1") {
      return {
        ...base,
        summary: {
          model: c.model,
          layer_keys: Object.keys((c.layers as object) ?? {}),
        },
      };
    }

    if (a.artifact_type === "phase1a_chunk_routing_manifest_v1") {
      return {
        ...base,
        summary: {
          total_chunks: c.total_chunks,
          deploy_sha: c.deploy_sha,
        },
      };
    }

    if (a.artifact_type === "story_map_seed_v1" || a.artifact_type === "evaluation_seed_v1") {
      const claims = (c.claims as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        summary: {
          claim_count: claims.length,
          first_claim: claims[0]?.hypothesis ?? null,
        },
      };
    }

    if (a.artifact_type === "quality_gate_result_v1") {
      return {
        ...base,
        summary: {
          pass: c.pass,
          failed_checks: (c.checks as Array<Record<string, unknown>>)
            ?.filter((ch) => !ch.pass)
            .map((ch) => ch.id) ?? [],
        },
      };
    }

    if (a.artifact_type === "evaluation_result_v2" || a.artifact_type === "evaluation_result_v1") {
      const overview = (c.overview as Record<string, unknown>) ?? {};
      const criteria = (c.criteria as Array<Record<string, unknown>>) ?? [];
      return {
        ...base,
        summary: {
          overall_score: (c.overall as Record<string, unknown>)?.overall_score_0_100,
          submission_readiness: overview.submission_readiness,
          criterion_count: criteria.length,
          scores: criteria.map((cr) => ({ key: cr.key, score: cr.final_score_0_10 })),
        },
      };
    }

    return base;
  });

  // Phase log from progress field
  const progress = (job.progress as Record<string, unknown> | null) ?? null;
  const phaseLogRaw = progress?.phase_log;
  const phaseLog: unknown[] = Array.isArray(phaseLogRaw) ? phaseLogRaw : [];
  const chunkRouting = progress?.chunk_routing ?? null;
  const narrativePreflight = {
    classifier_flagged: progress?.narrative_preflight_classifier_flagged ?? false,
    detected_type: progress?.narrative_preflight_detected_type ?? null,
  };

  // Phase timeline derived from job timestamps
  const phases = [
    { phase: "phase_0", label: "Phase 0 — Seed", started: job.phase0_started_at, completed: job.phase0_completed_at },
    { phase: "phase_1a", label: "Phase 1A — Character sweep", started: job.phase1_started_at, completed: job.phase1_completed_at },
    { phase: "phase_2", label: "Phase 2 — Pass 1+2+3", started: job.phase2_started_at, completed: job.phase2_completed_at },
    { phase: "phase_3", label: "Phase 3 — Quality gate", started: job.phase3_started_at, completed: job.phase3_completed_at },
  ].map((p) => {
    const startMs = p.started ? new Date(p.started).getTime() : null;
    const endMs = p.completed ? new Date(p.completed).getTime() : null;
    return {
      ...p,
      duration_ms: startMs && endMs ? endMs - startMs : null,
      status: p.completed ? "complete" : p.started ? "running" : "not_started",
    };
  });

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      phase: job.phase,
      phase_status: job.phase_status,
      manuscript_id: job.manuscript_id,
      manuscript_word_count: job.manuscript_word_count,
      work_type: job.work_type,
      english_variant: job.english_variant,
      total_units: job.total_units,
      completed_units: job.completed_units,
      failed_units: job.failed_units,
      attempt_count: job.attempt_count,
      max_attempts: job.max_attempts,
      retry_count: job.retry_count,
      next_attempt_at: job.next_attempt_at,
      last_error: job.last_error,
      failure_code: job.failure_code,
      lease_until: job.lease_until,
      heartbeat_at: job.heartbeat_at,
      created_at: job.created_at,
      updated_at: job.updated_at,
      started_at: job.started_at,
      completed_at: job.completed_at,
      failed_at: job.failed_at,
    },
    phases,
    artifacts,
    phase_log: phaseLog.slice(-30),
    chunk_routing: chunkRouting,
    narrative_preflight: narrativePreflight,
    artifact_types_present: artifacts.map((a) => a.artifact_type),
  });
}
