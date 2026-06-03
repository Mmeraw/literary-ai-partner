import { runPolishPass, polishFindingsToOpportunities } from "@/lib/evaluation/polishPass";
import { upsertEvaluationArtifact } from "@/lib/evaluation/artifactPersistence";
import { resolveFinalReviewSourceText } from "@/lib/revision/finalReviewSourceText";

type SupabaseLike = any;

type PolishVersionRow = {
  id: string;
  manuscript_id: number;
  version_number: number | null;
  source_version_id: string | null;
  raw_text: string | null;
  word_count: number | null;
};

type CompletedEvaluationRow = {
  id: string;
  manuscript_id: number;
  manuscript_version_id: string | null;
  evaluation_project_id: string | null;
  created_at: string | null;
};

type ManuscriptRow = {
  id: number;
  title: string | null;
  work_type: string | null;
  word_count: number | null;
  user_id: string | null;
};

export type SurfacePolishPathwayResult = {
  ok: true;
  pathway: "manuscript_version_surface_polish";
  manuscript_id: number;
  manuscript_version_id: string;
  manuscript_version_number: number | null;
  eligibility_evaluation_job_id: string;
  findings_count: number;
  opportunities_count: number;
  chunks_processed: number;
  duration_ms: number;
  artifact_type: "polish_pass_v1";
  artifact_id: string | null;
  prompt_version: string;
  skipped_full_evaluation_phases: string[];
  opportunities: ReturnType<typeof polishFindingsToOpportunities>;
};

export class SurfacePolishPathwayError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "SurfacePolishPathwayError";
    this.status = status;
  }
}

function countWords(text: string): number {
  const clean = text.trim();
  return clean ? clean.split(/\s+/).length : 0;
}

function normalizeVersionId(value: string | null | undefined): string {
  return (value ?? "").trim();
}

async function resolveManuscript(input: {
  supabase: SupabaseLike;
  manuscriptId: number;
  userId: string;
}): Promise<ManuscriptRow> {
  const { data, error } = await input.supabase
    .from("manuscripts")
    .select("id, title, work_type, word_count, user_id")
    .eq("id", input.manuscriptId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) throw new SurfacePolishPathwayError(error.message, 500);
  if (!data) throw new SurfacePolishPathwayError("Manuscript not found in your workspace.", 404);
  return data as ManuscriptRow;
}

async function resolveVersion(input: {
  supabase: SupabaseLike;
  manuscriptId: number;
  versionId: string;
}): Promise<PolishVersionRow> {
  const versionId = normalizeVersionId(input.versionId);
  if (!versionId) throw new SurfacePolishPathwayError("Missing manuscript version id.", 400);

  let query = input.supabase
    .from("manuscript_versions")
    .select("id, manuscript_id, version_number, source_version_id, raw_text, word_count")
    .eq("manuscript_id", input.manuscriptId);

  if (versionId.toLowerCase() === "latest") {
    query = query.order("version_number", { ascending: false }).limit(1);
  } else {
    query = query.eq("id", versionId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new SurfacePolishPathwayError(error.message, 500);
  if (!data) throw new SurfacePolishPathwayError("Manuscript version not found.", 404);
  return data as PolishVersionRow;
}

async function resolveEligibilityEvaluation(input: {
  supabase: SupabaseLike;
  manuscriptId: number;
  requiredEvaluationJobId?: string | null;
}): Promise<CompletedEvaluationRow> {
  let query = input.supabase
    .from("evaluation_jobs")
    .select("id, manuscript_id, manuscript_version_id, evaluation_project_id, created_at")
    .eq("manuscript_id", input.manuscriptId)
    .eq("status", "complete");

  if (input.requiredEvaluationJobId) {
    query = query.eq("id", input.requiredEvaluationJobId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new SurfacePolishPathwayError(error.message, 500);
  if (!data) {
    throw new SurfacePolishPathwayError(
      input.requiredEvaluationJobId
        ? "Evaluation must be complete before running Polish Pass."
        : "Polish Pass requires at least one completed structural evaluation for this manuscript.",
      400,
    );
  }

  return data as CompletedEvaluationRow;
}

async function resolveVersionText(input: {
  supabase: SupabaseLike;
  manuscriptId: number;
  userId: string;
  version: PolishVersionRow;
}): Promise<string> {
  const rawText = (input.version.raw_text ?? "").trim();
  if (rawText) return rawText;

  const resolved = await resolveFinalReviewSourceText({
    supabase: input.supabase,
    manuscriptId: input.manuscriptId,
    userId: input.userId,
    sourceVersionId: input.version.id,
    fallbackRawText: input.version.raw_text ?? "",
  });

  return resolved.trim();
}

export async function runSurfacePolishForManuscriptVersion(input: {
  supabase: SupabaseLike;
  userId: string;
  manuscriptId: number;
  versionId: string;
  openaiApiKey: string;
  requiredEvaluationJobId?: string | null;
}): Promise<SurfacePolishPathwayResult> {
  if (!Number.isInteger(input.manuscriptId) || input.manuscriptId <= 0) {
    throw new SurfacePolishPathwayError("Invalid manuscript id.", 400);
  }

  if (!input.openaiApiKey) {
    throw new SurfacePolishPathwayError("OpenAI API key not configured.", 500);
  }

  const manuscript = await resolveManuscript({
    supabase: input.supabase,
    manuscriptId: input.manuscriptId,
    userId: input.userId,
  });

  const version = await resolveVersion({
    supabase: input.supabase,
    manuscriptId: input.manuscriptId,
    versionId: input.versionId,
  });

  const eligibilityEvaluation = await resolveEligibilityEvaluation({
    supabase: input.supabase,
    manuscriptId: input.manuscriptId,
    requiredEvaluationJobId: input.requiredEvaluationJobId,
  });

  const manuscriptText = await resolveVersionText({
    supabase: input.supabase,
    manuscriptId: input.manuscriptId,
    userId: input.userId,
    version,
  });

  if (!manuscriptText) {
    throw new SurfacePolishPathwayError("Manuscript version text is not available for Polish Pass.", 404);
  }

  const wordCount = version.word_count && version.word_count > 0
    ? version.word_count
    : manuscript.word_count && manuscript.word_count > 0
      ? manuscript.word_count
      : countWords(manuscriptText);

  const result = await runPolishPass({
    manuscriptText,
    title: manuscript.title || "Untitled",
    genre: manuscript.work_type || "fiction",
    wordCount,
    openaiApiKey: input.openaiApiKey,
  });

  const opportunities = polishFindingsToOpportunities(result.findings);
  const sourceHash = [
    "polish",
    "surface-only",
    `manuscript:${input.manuscriptId}`,
    `version:${version.id}`,
    `prompt:${result.prompt_version}`,
  ].join(":");

  const artifactContent = {
    pathway: "manuscript_version_surface_polish",
    no_full_evaluation_pipeline: true,
    manuscript_id: input.manuscriptId,
    manuscript_version_id: version.id,
    manuscript_version_number: version.version_number ?? null,
    source_version_id: version.source_version_id ?? null,
    eligibility_evaluation_job_id: eligibilityEvaluation.id,
    findings: result.findings,
    opportunities,
    chunks_processed: result.chunks_processed,
    duration_ms: result.duration_ms,
    prompt_version: result.prompt_version,
    generated_at: new Date().toISOString(),
    skipped_full_evaluation_phases: [
      "phase_0_authority_warmup",
      "phase_0_5a_story_map_seed",
      "phase_0_5b_evaluation_seed",
      "phase_1a_character_ledger",
      "pass_3a_preflight",
      "wave_longform_revision_plan",
      "full_narrative_synthesis",
    ],
  };

  const artifactId = await upsertEvaluationArtifact({
    supabase: input.supabase,
    jobId: eligibilityEvaluation.id,
    manuscriptId: input.manuscriptId,
    evaluationProjectId: eligibilityEvaluation.evaluation_project_id ?? undefined,
    artifactType: "polish_pass_v1",
    artifactVersion: "polish_pass_v1",
    sourceHash,
    content: artifactContent,
  }).catch((error) => {
    console.error("[surface-polish-pathway] Failed to persist polish_pass_v1", error);
    return null;
  });

  return {
    ok: true,
    pathway: "manuscript_version_surface_polish",
    manuscript_id: input.manuscriptId,
    manuscript_version_id: version.id,
    manuscript_version_number: version.version_number ?? null,
    eligibility_evaluation_job_id: eligibilityEvaluation.id,
    findings_count: result.findings.length,
    opportunities_count: opportunities.length,
    chunks_processed: result.chunks_processed,
    duration_ms: result.duration_ms,
    artifact_type: "polish_pass_v1",
    artifact_id: artifactId,
    prompt_version: result.prompt_version,
    skipped_full_evaluation_phases: artifactContent.skipped_full_evaluation_phases,
    opportunities,
  };
}
