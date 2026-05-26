import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createDerivedVersion } from "@/lib/manuscripts/versions";

export type FinalReviewExportFormat = "clean" | "marked" | "changelog";

export type FinalReviewRuntimeInput = {
  manuscriptId: string | number;
  evaluationJobId: string;
};

type RuntimeContext = {
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
  manuscriptId: number;
  manuscriptTitle: string;
  evaluationJobId: string;
  sourceVersionId: string;
  sourceText: string;
  decisions: RuntimeDecision[];
};

type RuntimeDecision = {
  id: string;
  opportunity_id: string;
  opportunity_title: string;
  decision: string;
  selected_option: string | null;
  custom_text: string | null;
  selected_text: string | null;
  source_excerpt: string | null;
  source_location: string | null;
  created_at: string;
};

const APPLICABLE = new Set(["accepted_a", "accepted_b", "accepted_c", "custom"]);

function safeFilename(title: string, suffix: string, ext: string): string {
  const base = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().replace(/^-|-$/g, "").slice(0, 50) || "manuscript";
  return `revisiongrade-${base}-${suffix}.${ext}`;
}

async function loadRuntimeContext(input: FinalReviewRuntimeInput): Promise<RuntimeContext> {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Not authenticated");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) throw new Error("Invalid manuscript id");

  const supabase = createAdminClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, user_id")
    .eq("id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error("Manuscript not found in your workspace");

  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Evaluation job not found for this manuscript");
  if (job.status !== "complete") throw new Error("Evaluation must be complete before Final Review can apply or export.");
  if (!job.manuscript_version_id) throw new Error("Evaluation is missing source manuscript version.");

  const { data: version, error: versionError } = await supabase
    .from("manuscript_versions")
    .select("id, raw_text")
    .eq("id", job.manuscript_version_id)
    .maybeSingle();

  if (versionError) throw new Error(versionError.message);
  if (!version) throw new Error("Source manuscript version not found.");

  const { data: rows, error: ledgerError } = await supabase
    .from("revision_ledger_decisions")
    .select("id, opportunity_id, opportunity_title, decision, selected_option, custom_text, selected_text, source_excerpt, source_location, created_at")
    .eq("user_id", user.id)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("is_undo", false)
    .order("created_at", { ascending: false });

  if (ledgerError) throw new Error(ledgerError.message);

  const latestByOpportunity = new Map<string, RuntimeDecision>();
  for (const row of (rows ?? []) as RuntimeDecision[]) {
    if (!latestByOpportunity.has(row.opportunity_id)) latestByOpportunity.set(row.opportunity_id, row);
  }

  return {
    supabase,
    userId: user.id,
    manuscriptId,
    manuscriptTitle: manuscript.title ?? "Untitled Manuscript",
    evaluationJobId: String(input.evaluationJobId),
    sourceVersionId: job.manuscript_version_id,
    sourceText: version.raw_text ?? "",
    decisions: [...latestByOpportunity.values()],
  };
}

function applicableDecisions(decisions: RuntimeDecision[]): RuntimeDecision[] {
  return decisions.filter((d) => APPLICABLE.has(d.decision));
}

function buildChangelog(ctx: RuntimeContext): string {
  const lines = [
    `RevisionGrade Final Review Changelog`,
    `Manuscript: ${ctx.manuscriptTitle}`,
    `Evaluation Job: ${ctx.evaluationJobId}`,
    `Generated: ${new Date().toISOString()}`,
    "",
  ];

  if (ctx.decisions.length === 0) {
    lines.push("No synced revision decisions were found.");
    return lines.join("\n");
  }

  for (const decision of ctx.decisions) {
    lines.push(`- ${decision.decision.toUpperCase()} — ${decision.opportunity_title}`);
    if (decision.selected_option) lines.push(`  Option: ${decision.selected_option}`);
    if (decision.source_location) lines.push(`  Location: ${decision.source_location}`);
    if (decision.source_excerpt) lines.push(`  Source: ${decision.source_excerpt}`);
    if (decision.selected_text) lines.push(`  Selected text: ${decision.selected_text}`);
    if (decision.custom_text) lines.push(`  Custom text: ${decision.custom_text}`);
    lines.push(`  Created: ${decision.created_at}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildMarkedText(ctx: RuntimeContext): string {
  const lines = [
    `RevisionGrade Marked Review Copy`,
    `Manuscript: ${ctx.manuscriptTitle}`,
    `Generated: ${new Date().toISOString()}`,
    "",
    ctx.sourceText,
    "",
    "--- Revision Changelog ---",
    buildChangelog(ctx),
  ];
  return lines.join("\n");
}

function applyTextSnapshots(ctx: RuntimeContext): { text: string; applied: RuntimeDecision[]; blocked: string[] } {
  let text = ctx.sourceText;
  const applied: RuntimeDecision[] = [];
  const blocked: string[] = [];

  for (const decision of applicableDecisions(ctx.decisions)) {
    const replacement = decision.decision === "custom" ? decision.custom_text : decision.selected_text;
    const source = decision.source_excerpt;

    if (!replacement || !source) {
      blocked.push(`${decision.opportunity_title}: missing source excerpt or selected replacement text.`);
      continue;
    }

    if (!text.includes(source)) {
      blocked.push(`${decision.opportunity_title}: source excerpt no longer matches source manuscript version.`);
      continue;
    }

    text = text.replace(source, replacement);
    applied.push(decision);
  }

  return { text, applied, blocked };
}

async function recordRun(
  ctx: RuntimeContext,
  input: {
    status: "blocked" | "applied" | "exported";
    mode: "apply" | "export_clean" | "export_marked" | "export_changelog";
    revisedVersionId?: string | null;
    appliedDecisionIds?: string[];
    skippedDecisionIds?: string[];
    blockedReason?: string | null;
    exportFormat?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await ctx.supabase.from("final_review_apply_runs").insert({
    user_id: ctx.userId,
    manuscript_id: ctx.manuscriptId,
    evaluation_job_id: ctx.evaluationJobId,
    source_version_id: ctx.sourceVersionId,
    revised_version_id: input.revisedVersionId ?? null,
    status: input.status,
    mode: input.mode,
    applied_decision_ids: input.appliedDecisionIds ?? [],
    skipped_decision_ids: input.skippedDecisionIds ?? [],
    blocked_reason: input.blockedReason ?? null,
    export_format: input.exportFormat ?? null,
    metadata: input.metadata ?? {},
  });
}

export async function applyFinalReviewDecisions(input: FinalReviewRuntimeInput) {
  const ctx = await loadRuntimeContext(input);
  const result = applyTextSnapshots(ctx);

  if (result.applied.length === 0 || result.blocked.length > 0) {
    await recordRun(ctx, {
      status: "blocked",
      mode: "apply",
      skippedDecisionIds: applicableDecisions(ctx.decisions).map((d) => d.id),
      blockedReason: result.blocked.join(" | ") || "No applicable accepted/custom decisions with persisted text snapshots.",
      metadata: { blocked: result.blocked },
    });
    return { ok: false, error: result.blocked.join("\n") || "No applicable accepted/custom decisions with persisted text snapshots." };
  }

  const version = await createDerivedVersion({
    manuscript_id: ctx.manuscriptId,
    source_version_id: ctx.sourceVersionId,
    raw_text: result.text,
    created_by: ctx.userId,
  });

  await recordRun(ctx, {
    status: "applied",
    mode: "apply",
    revisedVersionId: version.id,
    appliedDecisionIds: result.applied.map((d) => d.id),
    skippedDecisionIds: ctx.decisions.filter((d) => !APPLICABLE.has(d.decision)).map((d) => d.id),
    metadata: { applied_count: result.applied.length },
  });

  return { ok: true, revisedVersionId: version.id, appliedCount: result.applied.length };
}

export async function buildFinalReviewExport(input: FinalReviewRuntimeInput & { format: FinalReviewExportFormat }) {
  const ctx = await loadRuntimeContext(input);
  const applied = applyTextSnapshots(ctx);
  const format = input.format;
  let content = "";
  let suffix = "";

  if (format === "changelog") {
    content = buildChangelog(ctx);
    suffix = "changelog";
  } else if (format === "marked") {
    content = buildMarkedText(ctx);
    suffix = "marked-review-copy";
  } else {
    if (applied.blocked.length > 0) {
      content = `${ctx.sourceText}\n\n--- RevisionGrade Clean Draft Notice ---\nClean export could not apply all decisions because some accepted/custom decisions are missing source/replacement snapshots. Exported source text unchanged.\n\n${applied.blocked.join("\n")}`;
    } else {
      content = applied.text;
    }
    suffix = "clean-draft";
  }

  await recordRun(ctx, {
    status: "exported",
    mode: format === "clean" ? "export_clean" : format === "marked" ? "export_marked" : "export_changelog",
    appliedDecisionIds: applied.applied.map((d) => d.id),
    skippedDecisionIds: ctx.decisions.filter((d) => !APPLICABLE.has(d.decision)).map((d) => d.id),
    exportFormat: "txt",
    metadata: { export_kind: format, blocked: applied.blocked },
  });

  return {
    content,
    filename: safeFilename(ctx.manuscriptTitle, suffix, "txt"),
    contentType: "text/plain; charset=utf-8",
  };
}
