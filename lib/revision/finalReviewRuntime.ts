import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createDerivedVersion } from "@/lib/manuscripts/versions";
import { upsertEvaluationArtifact } from "@/lib/evaluation/artifactPersistence";
import { resolveFinalReviewSourceText, scrubInternalReportLeakage } from "@/lib/revision/finalReviewSourceText";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import {
  buildReviseCompletionCertification,
  type ReviseCompletionCertificationResult,
} from "@/lib/revision/reviseCompletionCertification";

export type FinalReviewExportFormat = "clean" | "marked" | "changelog";
export type FinalReviewExportFile = "txt" | "pdf" | "docx";

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
  queueSummary: RuntimeQueueSummary;
};

type RuntimeQueueSummary = {
  copyPasteOpportunityIds: Set<string>;
  copyPasteCount: number;
  strategyCount: number;
  withheldBlockedCount: number;
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
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const APPLICABLE = new Set(["accepted_a", "accepted_b", "accepted_c", "custom"]);

const EMPTY_QUEUE_SUMMARY: RuntimeQueueSummary = {
  copyPasteOpportunityIds: new Set(),
  copyPasteCount: 0,
  strategyCount: 0,
  withheldBlockedCount: 0,
};

function normalizedEmailList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function isPrivilegedRevisionViewer(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;

  const allowlist = new Set<string>([
    ...normalizedEmailList(process.env.EVALUATION_OPERATOR_EMAILS),
    ...normalizedEmailList(process.env.REVISIONGRADE_ADMIN_EMAILS),
  ]);

  return allowlist.has(email);
}

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
    .maybeSingle();

  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error("Manuscript not found in your workspace");

  const privilegedRead = isPrivilegedRevisionViewer(user);
  const manuscriptOwnerId = typeof manuscript.user_id === "string" ? manuscript.user_id : null;
  const isOwner = manuscriptOwnerId === user.id;
  if (!isOwner && !manuscriptOwnerId) {
    throw new Error("Manuscript ownership metadata is missing.");
  }
  if (!isOwner && !privilegedRead) {
    throw new Error("Manuscript not found in your workspace");
  }
  const ledgerOwnerId = isOwner ? user.id : manuscriptOwnerId;

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
    .select("id, opportunity_id, opportunity_title, decision, selected_option, custom_text, selected_text, source_excerpt, source_location, metadata, created_at")
    .eq("user_id", ledgerOwnerId)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("is_undo", false)
    .order("created_at", { ascending: false });

  if (ledgerError) throw new Error(ledgerError.message);

  const latestByOpportunity = new Map<string, RuntimeDecision>();
  for (const row of (rows ?? []) as RuntimeDecision[]) {
    if (!latestByOpportunity.has(row.opportunity_id)) latestByOpportunity.set(row.opportunity_id, row);
  }

  const sourceText = await resolveFinalReviewSourceText({
    supabase,
    manuscriptId,
    userId: ledgerOwnerId ?? user.id,
    sourceVersionId: job.manuscript_version_id,
    fallbackRawText: version.raw_text ?? "",
  });

  let queueSummary = EMPTY_QUEUE_SUMMARY;
  const queuePayload = await getWorkbenchQueue({
    manuscriptId: String(manuscriptId),
    evaluationJobId: String(input.evaluationJobId),
  });
  if (!queuePayload.ok) {
    throw new Error(queuePayload.error ?? "Revise Queue unavailable for completion certification.");
  }
  const copyPasteOpportunityIds = new Set(queuePayload.opportunities.map((opportunity) => opportunity.id));
  const strategyCount = queuePayload.needsTargeting.filter((opportunity) => opportunity.cardType === "revision_strategy").length;
  const withheldBlockedCount = queuePayload.withheldUnsupported.length + queuePayload.needsTargeting.filter((opportunity) => opportunity.cardType !== "revision_strategy").length;
  queueSummary = {
    copyPasteOpportunityIds,
    copyPasteCount: copyPasteOpportunityIds.size,
    strategyCount,
    withheldBlockedCount,
  };

  return {
    supabase,
    userId: user.id,
    manuscriptId,
    manuscriptTitle: manuscript.title ?? "Untitled Manuscript",
    evaluationJobId: String(input.evaluationJobId),
    sourceVersionId: job.manuscript_version_id,
    sourceText,
    decisions: [...latestByOpportunity.values()],
    queueSummary,
  };
}

function isCopyPasteExecutableDecision(ctx: RuntimeContext, decision: RuntimeDecision): boolean {
  if (!APPLICABLE.has(decision.decision)) return false;
  return ctx.queueSummary.copyPasteOpportunityIds.has(decision.opportunity_id);
}

function applicableDecisions(ctx: RuntimeContext): RuntimeDecision[] {
  return ctx.decisions.filter((decision) => isCopyPasteExecutableDecision(ctx, decision));
}

function certifyCompletion(ctx: RuntimeContext): ReviseCompletionCertificationResult {
  return buildReviseCompletionCertification({
    manuscriptId: ctx.manuscriptId,
    evaluationJobId: ctx.evaluationJobId,
    readyOpportunityIds: [...ctx.queueSummary.copyPasteOpportunityIds],
    decisions: ctx.decisions,
    needsTargetingCount: ctx.queueSummary.strategyCount,
    withheldUnsupportedCount: ctx.queueSummary.withheldBlockedCount,
    pendingSyncCount: 0,
  });
}

function completionMetadata(result: ReviseCompletionCertificationResult): Record<string, unknown> {
  return result.ok === true
    ? { revision_completion_certification: result.record }
    : { revision_completion_failure: result.failure };
}

async function persistCompletionArtifact(ctx: RuntimeContext, completion: ReviseCompletionCertificationResult): Promise<string | null> {
  if (completion.ok === false) return null;
  return upsertEvaluationArtifact({
    supabase: ctx.supabase,
    jobId: ctx.evaluationJobId,
    manuscriptId: ctx.manuscriptId,
    artifactType: "revision_completion_record_v1",
    artifactVersion: "revision_completion_record_v1",
    content: completion.record,
    sourceHash: completion.record.certification_hash,
  });
}

function decisionLabel(decision: RuntimeDecision): string {
  if (decision.decision === "accepted_a" || decision.decision === "accepted_b" || decision.decision === "accepted_c") return `Accepted ${decision.selected_option ?? ""}`.trim();
  if (decision.decision === "custom") return "Custom rewrite";
  if (decision.decision === "keep_original") return "Kept original";
  if (decision.decision === "reject") return "Rejected";
  if (decision.decision === "deferred") return "Deferred";
  return decision.decision;
}

function cleanLocation(value: string | null): string | null {
  if (!value) return null;
  if (/^[A-Z_]+:recommendation$/i.test(value)) return null;
  if (/^[A-Z_]+:[a-z_]+$/i.test(value)) return null;
  return value;
}

function buildChangelog(ctx: RuntimeContext): string {
  const lines = ["RevisionGrade Final Review Changelog", `Manuscript: ${ctx.manuscriptTitle}`, ""];

  const executable = applicableDecisions(ctx);
  lines.push("TrustedPath summary");
  lines.push(`${executable.length} safe copy-paste repair${executable.length === 1 ? "" : "s"} applied or ready to apply.`);
  lines.push(`${ctx.queueSummary.strategyCount} Strategy Card${ctx.queueSummary.strategyCount === 1 ? "" : "s"} require author decision and were not applied.`);
  lines.push(`${ctx.queueSummary.withheldBlockedCount} withheld/blocked card${ctx.queueSummary.withheldBlockedCount === 1 ? "" : "s"} stayed invisible to the semi-revised manuscript.`);
  lines.push("TrustedPath applies only safe, local copy-paste repairs. More complex revision opportunities remain available as Strategy Cards for author review. Your downloaded semi-revised manuscript preserves all unchanged sections exactly as submitted.");
  lines.push("");

  if (ctx.decisions.length === 0) {
    lines.push("No synced revision decisions were found.");
    return lines.join("\n");
  }

  for (const decision of ctx.decisions) {
    lines.push(`${decisionLabel(decision)} — ${decision.opportunity_title}`);
    if (decision.selected_option) lines.push(`Option: ${decision.selected_option}`);
    const location = cleanLocation(decision.source_location);
    if (location) lines.push(`Location: ${location}`);
    if (decision.source_excerpt) lines.push(`Original: ${scrubInternalReportLeakage(decision.source_excerpt)}`);
    if (decision.selected_text) lines.push(`Selected revision: ${scrubInternalReportLeakage(decision.selected_text)}`);
    if (decision.custom_text) lines.push(`Custom text: ${scrubInternalReportLeakage(decision.custom_text)}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildMarkedText(ctx: RuntimeContext): string {
  if (!ctx.sourceText.trim()) {
    return [
      "RevisionGrade Marked Review Copy",
      `Manuscript: ${ctx.manuscriptTitle}`,
      "",
      "Full manuscript source text is unavailable for this legacy evaluation. Use the changelog export to review synced decisions.",
      "",
      "Revision Changelog",
      buildChangelog(ctx),
    ].join("\n");
  }

  return [
    "RevisionGrade Marked Review Copy",
    `Manuscript: ${ctx.manuscriptTitle}`,
    "",
    ctx.sourceText,
    "",
    "Revision Changelog",
    buildChangelog(ctx),
  ].join("\n");
}

function applyTextSnapshots(ctx: RuntimeContext): { text: string; applied: RuntimeDecision[]; blocked: string[] } {
  let text = scrubInternalReportLeakage(ctx.sourceText);
  const applied: RuntimeDecision[] = [];
  const blocked: string[] = [];

  if (!text.trim()) {
    return { text: "", applied, blocked: ["Full manuscript source text is unavailable for this legacy evaluation."] };
  }

  for (const decision of applicableDecisions(ctx)) {
    const replacement = scrubInternalReportLeakage(decision.decision === "custom" ? decision.custom_text ?? "" : decision.selected_text ?? "");
    const source = scrubInternalReportLeakage(decision.source_excerpt ?? "");

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
  const completion = certifyCompletion(ctx);
  if (completion.ok === false) {
    await recordRun(ctx, {
      status: "blocked",
      mode: "apply",
      skippedDecisionIds: ctx.decisions.map((d) => d.id),
      blockedReason: completion.failure.user_safe_summary,
      metadata: completionMetadata(completion),
    });
    return { ok: false, error: completion.failure.user_safe_summary };
  }
  const completionArtifactId = await persistCompletionArtifact(ctx, completion);

  const result = applyTextSnapshots(ctx);

  if (result.applied.length === 0 || result.blocked.length > 0) {
    await recordRun(ctx, {
      status: "blocked",
      mode: "apply",
      skippedDecisionIds: ctx.decisions.filter((decision) => APPLICABLE.has(decision.decision)).map((d) => d.id),
      blockedReason: result.blocked.join(" | ") || "No applicable accepted/custom decisions with persisted text snapshots.",
      metadata: { blocked: result.blocked, revision_completion_artifact_id: completionArtifactId, ...completionMetadata(completion) },
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
    skippedDecisionIds: ctx.decisions.filter((decision) => !isCopyPasteExecutableDecision(ctx, decision)).map((d) => d.id),
    metadata: {
      applied_count: result.applied.length,
      copy_paste_repair_count: ctx.queueSummary.copyPasteCount,
      strategy_card_count: ctx.queueSummary.strategyCount,
      withheld_blocked_count: ctx.queueSummary.withheldBlockedCount,
      revision_completion_artifact_id: completionArtifactId,
      ...completionMetadata(completion),
    },
  });

  return { ok: true, revisedVersionId: version.id, appliedCount: result.applied.length };
}

export async function buildFinalReviewExport(input: FinalReviewRuntimeInput & { format: FinalReviewExportFormat; file?: FinalReviewExportFile }) {
  const ctx = await loadRuntimeContext(input);
  const completion = certifyCompletion(ctx);
  if (completion.ok === false) {
    const format = input.format;
    const file = input.file ?? "txt";
    await recordRun(ctx, {
      status: "blocked",
      mode: format === "clean" ? "export_clean" : format === "marked" ? "export_marked" : "export_changelog",
      skippedDecisionIds: ctx.decisions.map((d) => d.id),
      blockedReason: completion.failure.user_safe_summary,
      exportFormat: file,
      metadata: completionMetadata(completion),
    });

    return {
      content: completion.failure.user_safe_summary,
      filename: safeFilename(ctx.manuscriptTitle, "final-review-blocked", "txt"),
      contentType: "text/plain; charset=utf-8",
    };
  }
  const completionArtifactId = await persistCompletionArtifact(ctx, completion);

  const applied = applyTextSnapshots(ctx);
  const format = input.format;
  const file = input.file ?? "txt";
  let content = "";
  let suffix = "";

  if (format === "changelog") {
    content = buildChangelog(ctx);
    suffix = "changelog";
  } else if (format === "marked") {
    content = buildMarkedText(ctx);
    suffix = "marked-review-copy";
  } else {
    if (!ctx.sourceText.trim()) {
      content = "Clean Draft export is unavailable because the full manuscript source text is not connected for this legacy evaluation. Use the Revision Changelog export to review synced decisions.";
    } else if (applied.blocked.length > 0) {
      content = `Clean Draft export is blocked until all accepted/custom decisions can be matched to the source manuscript.\n\n${applied.blocked.join("\n")}`;
    } else {
      content = applied.text;
    }
    suffix = "semi-revised-draft";
  }

  await recordRun(ctx, {
    status: "exported",
    mode: format === "clean" ? "export_clean" : format === "marked" ? "export_marked" : "export_changelog",
    appliedDecisionIds: applied.applied.map((d) => d.id),
    skippedDecisionIds: ctx.decisions.filter((decision) => !isCopyPasteExecutableDecision(ctx, decision)).map((d) => d.id),
    exportFormat: file,
    metadata: {
      export_kind: format,
      requested_file: file,
      blocked: applied.blocked,
      copy_paste_repair_count: ctx.queueSummary.copyPasteCount,
      strategy_card_count: ctx.queueSummary.strategyCount,
      withheld_blocked_count: ctx.queueSummary.withheldBlockedCount,
      revision_completion_artifact_id: completionArtifactId,
      ...completionMetadata(completion),
    },
  });

  return {
    content,
    filename: safeFilename(ctx.manuscriptTitle, suffix, "txt"),
    contentType: "text/plain; charset=utf-8",
  };
}
