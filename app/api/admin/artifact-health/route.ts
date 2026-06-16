import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { TEST_MANUSCRIPT_ID_MIN, isTestManuscript } from "@/lib/manuscripts/testRange";
import {
  ARTIFACT_REGISTRY,
  KICK_MATRIX,
  PROCESS_REGISTRY,
  type ArtifactRegistryEntry,
  type ProcessRegistryEntry,
} from "@/lib/evaluation/fipocRegistry";
import {
  EVALUATE_ARTIFACT_QUALITY_THRESHOLD,
  evaluateArtifactPayloadQuality,
} from "@/lib/evaluation/artifactQualityCertification";

export const dynamic = "force-dynamic";

const CANONICAL_STATUSES = new Set(["queued", "running", "complete", "failed"]);

type JobRow = {
  id: string;
  manuscript_id: number | null;
  user_id: string | null;
  job_type: string | null;
  status: string;
  phase: string | null;
  phase_status: string | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  manuscripts?: Array<{ title: string | null; word_count: number | null }> | { title: string | null; word_count: number | null } | null;
};

type ArtifactRow = {
  id: string;
  job_id: string;
  manuscript_id: number | null;
  artifact_type: string;
  artifact_version: string | null;
  created_at: string;
  source_hash: string | null;
  content: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickStatusSignals(content: unknown): Record<string, unknown> {
  if (!isRecord(content)) return {};
  const signals: Record<string, unknown> = {};
  for (const key of [
    "status",
    "verdict",
    "decision",
    "blocking",
    "overallStatus",
    "dialogueStatus",
    "gate_ready_status",
    "source_completeness_status",
  ]) {
    if (content[key] !== undefined) signals[key] = content[key];
  }
  return signals;
}

function contentShape(content: unknown): { topLevelKeys: string[]; sizeBytes: number | null } {
  const sizeBytes = content == null ? null : new TextEncoder().encode(JSON.stringify(content)).length;
  return {
    topLevelKeys: isRecord(content) ? Object.keys(content).sort().slice(0, 40) : [],
    sizeBytes,
  };
}

function processForStage(stageId: string): ProcessRegistryEntry | null {
  return PROCESS_REGISTRY.find((entry) => entry.stageId === stageId) ?? null;
}

function consumerProcesses(artifact: ArtifactRegistryEntry): ProcessRegistryEntry[] {
  const consumerStageSet = new Set(artifact.consumerStageIds);
  return PROCESS_REGISTRY.filter(
    (entry) => consumerStageSet.has(entry.stageId) || entry.inputArtifacts.includes(artifact.artifact),
  );
}

function kickRowsForArtifact(artifact: ArtifactRegistryEntry) {
  const stages = new Set([artifact.producerStageId, ...artifact.consumerStageIds, artifact.regenerationOwnerStageId]);
  return KICK_MATRIX.filter((entry) => stages.has(entry.dirtyDataDetectedAt) || stages.has(entry.kickBackTo));
}

function registryContract(entry: ArtifactRegistryEntry) {
  const producer = processForStage(entry.producerStageId);
  const consumers = consumerProcesses(entry);
  return {
    artifact: entry.artifact,
    producerStageId: entry.producerStageId,
    producerProcessName: producer?.processName ?? entry.producerStageId,
    producerOutputMetrics: producer?.outputMetrics ?? [],
    consumerStageIds: entry.consumerStageIds,
    consumerProcessNames: consumers.map((consumer) => consumer.processName),
    consumerInputMetrics: consumers.flatMap((consumer) => consumer.inputMetrics),
    requiredFields: entry.requiredFields,
    completenessMetric: entry.completenessMetric,
    accuracyMetric: entry.accuracyMetric,
    dirtyDataRule: entry.dirtyDataRule,
    regenerationOwnerStageId: entry.regenerationOwnerStageId,
    requiredForAuthorExposure: entry.requiredForAuthorExposure,
    fitGapStatus: entry.fitGapStatus,
    processDirtyDataRules: [
      ...(producer?.dirtyDataRules ?? []),
      ...consumers.flatMap((consumer) => consumer.dirtyDataRules),
    ],
    processFailureCodes: [
      ...(producer?.failureCodes ?? []),
      ...consumers.flatMap((consumer) => consumer.failureCodes),
    ],
    kicks: kickRowsForArtifact(entry).map((kick) => ({
      dirtyDataDetectedAt: kick.dirtyDataDetectedAt,
      failure: kick.failure,
      kickBackTo: kick.kickBackTo,
      redoAction: kick.redoAction,
      retryLimit: kick.retryLimit,
      failureCode: kick.failureCode,
      blocksAuthorExposure: kick.blocksAuthorExposure,
    })),
  };
}

function manuscriptSummary(job: JobRow) {
  const relation = Array.isArray(job.manuscripts) ? job.manuscripts[0] : job.manuscripts;
  return {
    title: relation?.title ?? null,
    word_count: relation?.word_count ?? null,
  };
}

function summarizeArtifact(row: ArtifactRow) {
  const registryEntry = ARTIFACT_REGISTRY.find((entry) => entry.artifact === row.artifact_type) ?? null;
  const quality = evaluateArtifactPayloadQuality({
    artifact: row.artifact_type,
    content: row.content,
    registryEntry: registryEntry ?? undefined,
  });
  const shape = contentShape(row.content);
  return {
    id: row.id,
    jobId: row.job_id,
    manuscriptId: row.manuscript_id,
    artifactType: row.artifact_type,
    artifactVersion: row.artifact_version,
    createdAt: row.created_at,
    sourceHashPresent: Boolean(row.source_hash),
    registered: Boolean(registryEntry),
    registry: registryEntry ? registryContract(registryEntry) : null,
    quality: {
      score0To100: quality.score_0_100,
      threshold0To100: quality.threshold_0_100,
      certified: quality.certified,
      contractStatus: quality.contract_status,
      sipocMetrics: quality.sipoc_metrics,
      missingFields: quality.issues
        .filter((issue) => issue.code === "REQUIRED_FIELD_MISSING" || issue.code === "REQUIRED_FIELD_EMPTY")
        .map((issue) => issue.path),
      issues: quality.issues.map((issue) => ({
        code: issue.code,
        path: issue.path,
        message: issue.message,
      })),
    },
    statusSignals: pickStatusSignals(row.content),
    topLevelKeys: shape.topLevelKeys,
    sizeBytes: shape.sizeBytes,
  };
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = req.nextUrl;
  const jobId = searchParams.get("job_id")?.trim() || null;
  const status = searchParams.get("status")?.trim() || null;
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 25) || 25, 1), 100);
  const showTestParam = (searchParams.get("show_test") ?? "").toLowerCase();
  const showTestManuscripts = !(showTestParam === "0" || showTestParam === "false" || showTestParam === "no");

  if (status && !CANONICAL_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status filter" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    let jobsQuery = supabase
      .from("evaluation_jobs")
      .select("id,manuscript_id,user_id,job_type,status,phase,phase_status,failure_code,created_at,updated_at,completed_at,manuscripts(title,word_count)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (jobId) jobsQuery = jobsQuery.eq("id", jobId).limit(1);
    if (status) jobsQuery = jobsQuery.eq("status", status);
    if (!showTestManuscripts) jobsQuery = jobsQuery.lt("manuscript_id", TEST_MANUSCRIPT_ID_MIN);

    const { data: jobsData, error: jobsError } = await jobsQuery;
    if (jobsError) {
      console.error("[Admin Artifact Health] jobs query failed:", jobsError);
      return NextResponse.json(
        { ok: false, error: "Failed to fetch jobs", details: jobsError.message },
        { status: 500 },
      );
    }

    const jobs = ((jobsData ?? []) as unknown as JobRow[]).filter(
      (job) => showTestManuscripts || !isTestManuscript(job.manuscript_id ?? 0),
    );
    const jobIds = jobs.map((job) => job.id);

    let artifacts: ArtifactRow[] = [];
    if (jobIds.length > 0) {
      const { data: artifactsData, error: artifactsError } = await supabase
        .from("evaluation_artifacts")
        .select("id,job_id,manuscript_id,artifact_type,artifact_version,created_at,source_hash,content")
        .in("job_id", jobIds)
        .order("created_at", { ascending: true });

      if (artifactsError) {
        console.error("[Admin Artifact Health] artifacts query failed:", artifactsError);
        return NextResponse.json(
          { ok: false, error: "Failed to fetch artifacts", details: artifactsError.message },
          { status: 500 },
        );
      }

      artifacts = (artifactsData ?? []) as ArtifactRow[];
    }

    const artifactSummaries = artifacts.map(summarizeArtifact);
    const artifactTypesByJob = new Map<string, Set<string>>();
    const artifactSummaryByJobAndType = new Map<string, ReturnType<typeof summarizeArtifact>>();
    for (const artifact of artifactSummaries) {
      if (!artifactTypesByJob.has(artifact.jobId)) artifactTypesByJob.set(artifact.jobId, new Set());
      artifactTypesByJob.get(artifact.jobId)!.add(artifact.artifactType);
      artifactSummaryByJobAndType.set(`${artifact.jobId}:${artifact.artifactType}`, artifact);
    }

    const expectedArtifacts = jobs.flatMap((job) =>
      ARTIFACT_REGISTRY.map((entry) => {
        const persisted = artifactSummaryByJobAndType.get(`${job.id}:${entry.artifact}`) ?? null;
        return {
          jobId: job.id,
          manuscriptId: job.manuscript_id,
          artifactType: entry.artifact,
          present: Boolean(persisted),
          artifactId: persisted?.id ?? null,
          createdAt: persisted?.createdAt ?? null,
          sourceHashPresent: persisted?.sourceHashPresent ?? false,
          registry: registryContract(entry),
          quality: persisted?.quality ?? null,
          statusSignals: persisted?.statusSignals ?? {},
          topLevelKeys: persisted?.topLevelKeys ?? [],
          sizeBytes: persisted?.sizeBytes ?? null,
        };
      }),
    );

    const jobSummaries = jobs.map((job) => {
      const persistedTypes = artifactTypesByJob.get(job.id) ?? new Set<string>();
      const requiredExposureArtifacts = ARTIFACT_REGISTRY.filter((entry) => entry.requiredForAuthorExposure);
      const missingAuthorExposureArtifacts = requiredExposureArtifacts
        .filter((entry) => !persistedTypes.has(entry.artifact))
        .map((entry) => entry.artifact);
      const jobArtifacts = artifactSummaries.filter((artifact) => artifact.jobId === job.id);
      const contractCleanCount = jobArtifacts.filter((artifact) => artifact.quality.contractStatus === "clean").length;
      const registeredCount = jobArtifacts.filter((artifact) => artifact.registered).length;
      const averageQuality = jobArtifacts.length === 0
        ? null
        : Math.round(jobArtifacts.reduce((sum, artifact) => sum + artifact.quality.score0To100, 0) / jobArtifacts.length);

      return {
        id: job.id,
        manuscriptId: job.manuscript_id,
        manuscript: manuscriptSummary(job),
        userId: job.user_id,
        jobType: job.job_type,
        status: job.status,
        phase: job.phase,
        phaseStatus: job.phase_status,
        failureCode: job.failure_code,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        completedAt: job.completed_at ?? null,
        artifactCount: jobArtifacts.length,
        registeredArtifactCount: registeredCount,
        certifiedArtifactCount: contractCleanCount,
        contractCleanArtifactCount: contractCleanCount,
        averageQuality0To100: averageQuality,
        missingAuthorExposureArtifacts,
      };
    });

    const contractGapCount = artifactSummaries.filter((artifact) => artifact.quality.contractStatus !== "clean").length;
    const blockingSignalCount = artifactSummaries.filter((artifact) => {
      const signals = artifact.statusSignals;
      return signals.blocking === true || signals.verdict === "BLOCK" || signals.overallStatus === "FAIL";
    }).length;

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      qualityThreshold0To100: EVALUATE_ARTIFACT_QUALITY_THRESHOLD,
      qualityTarget0To100: EVALUATE_ARTIFACT_QUALITY_THRESHOLD,
      summary: {
        jobs: jobSummaries.length,
        artifacts: artifactSummaries.length,
        expectedArtifacts: expectedArtifacts.length,
        missingExpectedArtifacts: expectedArtifacts.filter((artifact) => !artifact.present).length,
        registeredArtifacts: artifactSummaries.filter((artifact) => artifact.registered).length,
        unregisteredArtifacts: artifactSummaries.filter((artifact) => !artifact.registered).length,
        belowThresholdArtifacts: contractGapCount,
        contractGapArtifacts: contractGapCount,
        blockingSignalArtifacts: blockingSignalCount,
        registryArtifacts: ARTIFACT_REGISTRY.length,
      },
      jobs: jobSummaries,
      expectedArtifacts,
      artifacts: artifactSummaries,
      registryArtifacts: ARTIFACT_REGISTRY.map(registryContract),
      filters: {
        jobId,
        status,
        limit,
        showTestManuscripts,
        testManuscriptIdMin: TEST_MANUSCRIPT_ID_MIN,
      },
    });
  } catch (err) {
    console.error("[Admin Artifact Health] unexpected error:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error", details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}