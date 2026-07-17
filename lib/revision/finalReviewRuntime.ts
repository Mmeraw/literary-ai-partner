import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { upsertEvaluationArtifact } from "@/lib/evaluation/artifactPersistence";
import { resolveFinalReviewSourceText, scrubInternalReportLeakage } from "@/lib/revision/finalReviewSourceText";
import { countOccurrences } from "@/lib/revision/finalReviewPresentation";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import {
  buildReviseCompletionCertification,
  type ReviseCompletionCertificationResult,
} from "@/lib/revision/reviseCompletionCertification";
import {
  normalizeRevisionAuthorityComparison,
  normalizeRevisionAuthorityText,
  revisionCandidateIdentitiesBySlot,
  revisionOpportunityVersion,
  type RevisionCandidateSlot,
} from "@/lib/revision/decisionAuthorityIdentity";

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
  decisionAuthorityConflicts: string[];
  queueSummary: RuntimeQueueSummary;
  queueByOpportunityId: Map<string, RuntimeQueueOpportunity>;
};

type RuntimeQueueSummary = {
  copyPasteOpportunityIds: Set<string>;
  copyPasteCount: number;
  strategyCount: number;
  withheldBlockedCount: number;
};

type RuntimeQueueOpportunity = {
  id: string;
  cardType: string | null;
  trustedPathStatus: string | null;
  sourceExcerpt: string;
  sourceLocation: string | null;
  sourceUedHash: string | null;
  sourceOpportunityId: string | null;
  sourceCriterion: string | null;
  optionTextByKey: Map<string, string>;
  candidateHashByKey: Map<RevisionCandidateSlot, string>;
  opportunityVersion: string;
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

function sourceTextOfQueueOpportunity(opportunity: {
  quoteHighlight?: string | null;
  quoteRest?: string | null;
}): string {
  return `${opportunity.quoteHighlight ?? ""}${opportunity.quoteRest ?? ""}`.trim();
}

function buildRuntimeQueueOpportunity(opportunity: {
  id: string;
  cardType?: string | null;
  trustedPathStatus?: string | null;
  quoteHighlight?: string | null;
  quoteRest?: string | null;
  anchor?: string | null;
  sourceUedHash?: string | null;
  sourceOpportunityId?: string | null;
  sourceCriterion?: string | null;
  options?: Array<{ key?: string | null; candidateText?: string | null; text?: string | null }>;
}): RuntimeQueueOpportunity {
  const optionTextByKey = new Map<string, string>();
  for (const option of opportunity.options ?? []) {
    const key = (option.key ?? "").trim().toUpperCase();
    if (!key) continue;
    const candidate = (option.candidateText ?? option.text ?? "").trim();
    optionTextByKey.set(key, candidate);
  }

  const sourceExcerpt = sourceTextOfQueueOpportunity(opportunity);
  const sourceLocation = typeof opportunity.anchor === "string" ? opportunity.anchor : null;
  const sourceUedHash = typeof opportunity.sourceUedHash === "string" ? opportunity.sourceUedHash : null;
  const sourceOpportunityId = typeof opportunity.sourceOpportunityId === "string" ? opportunity.sourceOpportunityId : null;
  const sourceCriterion = typeof opportunity.sourceCriterion === "string" ? opportunity.sourceCriterion : null;
  const cardType = typeof opportunity.cardType === "string" ? opportunity.cardType : null;
  const trustedPathStatus = typeof opportunity.trustedPathStatus === "string" ? opportunity.trustedPathStatus : null;
  const identityInput = {
    id: opportunity.id,
    sourceUedHash,
    sourceOpportunityId,
    sourceCriterion,
    sourceExcerpt,
    sourceLocation,
    cardType,
    trustedPathStatus,
    options: opportunity.options,
  };

  return {
    id: opportunity.id,
    cardType,
    trustedPathStatus,
    sourceExcerpt,
    sourceLocation,
    sourceUedHash,
    sourceOpportunityId,
    sourceCriterion,
    optionTextByKey,
    candidateHashByKey: revisionCandidateIdentitiesBySlot(identityInput),
    opportunityVersion: revisionOpportunityVersion(identityInput),
  };
}

function detectDecisionAuthorityConflicts(rows: RuntimeDecision[]): string[] {
  const conflicts: string[] = [];
  const byOpportunity = new Map<string, RuntimeDecision[]>();

  for (const row of rows) {
    const bucket = byOpportunity.get(row.opportunity_id) ?? [];
    bucket.push(row);
    byOpportunity.set(row.opportunity_id, bucket);
  }

  for (const [opportunityId, entries] of byOpportunity) {
    if (entries.length < 2) continue;
    const maxCreatedAt = entries.reduce((latest, entry) => (entry.created_at > latest ? entry.created_at : latest), entries[0]?.created_at ?? "");
    const latestRows = entries.filter((entry) => entry.created_at === maxCreatedAt);
    if (latestRows.length > 1) {
      conflicts.push(
        `Opportunity ${opportunityId} has ${latestRows.length} concurrent latest decisions at ${maxCreatedAt}; manual ledger reconciliation required before Final Review.`,
      );
    }
  }

  return conflicts;
}

function metadataValueAsString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = metadata?.[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;
}

function metadataCandidateSlot(metadata: Record<string, unknown> | null | undefined): RevisionCandidateSlot | null {
  const slot = metadataValueAsString(metadata, "candidateSlot")?.toUpperCase();
  return slot === "A" || slot === "B" || slot === "C" ? slot : null;
}

function validateDecisionAgainstAuthority(ctx: RuntimeContext, decision: RuntimeDecision): string | null {
  const queueOpportunity = ctx.queueByOpportunityId.get(decision.opportunity_id);
  if (!queueOpportunity) {
    return `${decision.opportunity_title}: opportunity missing from authoritative copy-paste queue.`;
  }

  if (queueOpportunity.cardType !== "copy_paste_rewrite" || queueOpportunity.trustedPathStatus !== "eligible") {
    return `${decision.opportunity_title}: opportunity is no longer TrustedPath-eligible for copy-paste apply.`;
  }

  const decisionOpportunityVersion = metadataValueAsString(decision.metadata, "opportunityVersion");
  if (!decisionOpportunityVersion) {
    return `${decision.opportunity_title}: decision is missing authoritative opportunityVersion; Final Review cannot prove opportunity-version identity.`;
  }
  if (decisionOpportunityVersion !== queueOpportunity.opportunityVersion) {
    return `${decision.opportunity_title}: opportunity version mismatch; decision was saved against a stale persisted opportunity version.`;
  }

  if (decision.decision === "accepted_a" || decision.decision === "accepted_b" || decision.decision === "accepted_c") {
    const selectedOption = (decision.selected_option ?? "").trim().toUpperCase();
    if (selectedOption !== "A" && selectedOption !== "B" && selectedOption !== "C") {
      return `${decision.opportunity_title}: accepted decision is missing selected option.`;
    }

    const candidateSlot = metadataCandidateSlot(decision.metadata);
    if (!candidateSlot) {
      return `${decision.opportunity_title}: accepted decision is missing authoritative candidateSlot.`;
    }
    if (candidateSlot !== selectedOption) {
      return `${decision.opportunity_title}: candidateSlot ${candidateSlot} does not match selected option ${selectedOption}.`;
    }

    const authoritativeCandidate = queueOpportunity.optionTextByKey.get(selectedOption) ?? "";
    if (!authoritativeCandidate.trim()) {
      return `${decision.opportunity_title}: authoritative candidate ${selectedOption} is missing in the current persisted opportunity.`;
    }

    const decisionCandidateHash = metadataValueAsString(decision.metadata, "candidateHash");
    if (!decisionCandidateHash) {
      return `${decision.opportunity_title}: accepted decision is missing authoritative candidateHash.`;
    }
    const authoritativeCandidateHash = queueOpportunity.candidateHashByKey.get(selectedOption);
    if (!authoritativeCandidateHash) {
      return `${decision.opportunity_title}: authoritative candidateHash for slot ${selectedOption} is missing in the current persisted opportunity.`;
    }
    if (decisionCandidateHash !== authoritativeCandidateHash) {
      return `${decision.opportunity_title}: candidate identity mismatch for slot ${selectedOption}; decision was saved against a stale candidate set.`;
    }

    if (normalizeRevisionAuthorityComparison(decision.selected_text) !== normalizeRevisionAuthorityComparison(authoritativeCandidate)) {
      return `${decision.opportunity_title}: selected text diagnostic mismatch for authoritative candidate ${selectedOption}; candidate identity matched but persisted replacement text differs.`;
    }
  }

  const authoritativeExcerpt = queueOpportunity.sourceExcerpt;
  if (!authoritativeExcerpt) {
    return `${decision.opportunity_title}: authoritative source excerpt is missing for apply identity validation.`;
  }

  if (normalizeRevisionAuthorityComparison(decision.source_excerpt) !== normalizeRevisionAuthorityComparison(authoritativeExcerpt)) {
    return `${decision.opportunity_title}: source identity mismatch (decision excerpt no longer matches authoritative opportunity excerpt).`;
  }

  if (normalizeRevisionAuthorityComparison(decision.source_location) !== normalizeRevisionAuthorityComparison(queueOpportunity.sourceLocation)) {
    return `${decision.opportunity_title}: source identity mismatch (decision location no longer matches authoritative opportunity location).`;
  }

  const decisionSourceUedHash = metadataValueAsString(decision.metadata, "sourceUedHash");
  if (decisionSourceUedHash && queueOpportunity.sourceUedHash && decisionSourceUedHash !== queueOpportunity.sourceUedHash) {
    return `${decision.opportunity_title}: source identity mismatch (decision sourceUedHash differs from authoritative persisted opportunity).`;
  }

  const decisionSourceOpportunityId = metadataValueAsString(decision.metadata, "sourceOpportunityId");
  if (decisionSourceOpportunityId && queueOpportunity.sourceOpportunityId && decisionSourceOpportunityId !== queueOpportunity.sourceOpportunityId) {
    return `${decision.opportunity_title}: source identity mismatch (decision sourceOpportunityId differs from authoritative persisted opportunity).`;
  }

  const decisionSourceCriterion = metadataValueAsString(decision.metadata, "sourceCriterion");
  if (decisionSourceCriterion && queueOpportunity.sourceCriterion && normalizeRevisionAuthorityComparison(decisionSourceCriterion) !== normalizeRevisionAuthorityComparison(queueOpportunity.sourceCriterion)) {
    return `${decision.opportunity_title}: source identity mismatch (decision sourceCriterion differs from authoritative persisted opportunity).`;
  }

  const decisionCardType = metadataValueAsString(decision.metadata, "cardType");
  if (decisionCardType && queueOpportunity.cardType && decisionCardType !== queueOpportunity.cardType) {
    return `${decision.opportunity_title}: stale decision metadata (cardType changed since decision sync).`;
  }

  const decisionTrustedPathStatus = metadataValueAsString(decision.metadata, "trustedPathStatus");
  if (decisionTrustedPathStatus && queueOpportunity.trustedPathStatus && decisionTrustedPathStatus !== queueOpportunity.trustedPathStatus) {
    return `${decision.opportunity_title}: stale decision metadata (trustedPathStatus changed since decision sync).`;
  }

  return null;
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
  if (!isOwner && !manuscriptOwnerId) throw new Error("Manuscript ownership metadata is missing.");
  if (!isOwner && !privilegedRead) throw new Error("Manuscript not found in your workspace");
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

  const decisionAuthorityConflicts = detectDecisionAuthorityConflicts((rows ?? []) as RuntimeDecision[]);

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

  const queuePayload = await getWorkbenchQueue({
    manuscriptId: String(manuscriptId),
    evaluationJobId: String(input.evaluationJobId),
  });
  if (!queuePayload.ok) throw new Error(queuePayload.error ?? "Revise Queue unavailable for completion certification.");

  const copyPasteOpportunityIds = new Set(queuePayload.opportunities.map((opportunity) => opportunity.id));
  const queueByOpportunityId = new Map(
    queuePayload.opportunities.map((opportunity) => [
      opportunity.id,
      buildRuntimeQueueOpportunity(opportunity),
    ]),
  );
  const strategyCount = queuePayload.needsTargeting.filter((opportunity) => opportunity.cardType === "revision_strategy").length;
  const withheldBlockedCount = queuePayload.withheldUnsupported.length + queuePayload.needsTargeting.filter((opportunity) => opportunity.cardType !== "revision_strategy").length;

  return {
    supabase,
    userId: user.id,
    manuscriptId,
    manuscriptTitle: manuscript.title ?? "Untitled Manuscript",
    evaluationJobId: String(input.evaluationJobId),
    sourceVersionId: job.manuscript_version_id,
    sourceText,
    decisions: [...latestByOpportunity.values()],
    decisionAuthorityConflicts,
    queueSummary: {
      copyPasteOpportunityIds,
      copyPasteCount: copyPasteOpportunityIds.size,
      strategyCount,
      withheldBlockedCount,
    },
    queueByOpportunityId,
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

type AnchoredSnapshot = {
  decision: RuntimeDecision;
  start: number;
  end: number;
  replacement: string;
};

function applyTextSnapshots(ctx: RuntimeContext): { text: string; applied: RuntimeDecision[]; blocked: string[] } {
  const text = scrubInternalReportLeakage(ctx.sourceText);
  const applied: RuntimeDecision[] = [];
  const blocked: string[] = [...ctx.decisionAuthorityConflicts];

  if (!text.trim()) {
    return { text: "", applied, blocked: ["Full manuscript source text is unavailable for this legacy evaluation."] };
  }

  const allIds = new Set<string>();
  for (const decision of ctx.decisions) {
    if (allIds.has(decision.id)) {
      blocked.push(`Duplicate decision id ${decision.id} in loaded ledger`);
      break;
    }
    allIds.add(decision.id);
  }
  if (blocked.length > 0) {
    return { text, applied, blocked };
  }

  const decisions = applicableDecisions(ctx);
  const seenIds = new Set<string>();
  const snapshots: AnchoredSnapshot[] = [];

  for (const decision of decisions) {
    const authorityViolation = validateDecisionAgainstAuthority(ctx, decision);
    if (authorityViolation) {
      blocked.push(authorityViolation);
      continue;
    }

    if (seenIds.has(decision.id)) {
      blocked.push(`${decision.opportunity_title}: duplicate decision id ${decision.id}`);
      continue;
    }
    seenIds.add(decision.id);

    const replacement = scrubInternalReportLeakage(decision.decision === "custom" ? decision.custom_text ?? "" : decision.selected_text ?? "");
    const source = scrubInternalReportLeakage(decision.source_excerpt ?? "");

    if (!replacement || !source) {
      blocked.push(`${decision.opportunity_title}: missing source excerpt or selected replacement text.`);
      continue;
    }

    const occurrences = countOccurrences(text, source);
    if (occurrences === 0) {
      blocked.push(`${decision.opportunity_title}: source excerpt anchor was not found in the current manuscript text.`);
      continue;
    }
    if (occurrences > 1) {
      blocked.push(`${decision.opportunity_title}: source excerpt is not unique in the manuscript.`);
      continue;
    }

    const start = text.indexOf(source);
    snapshots.push({ decision, start, end: start + source.length, replacement });
  }

  if (blocked.length > 0) {
    return { text, applied, blocked };
  }

  const sorted = [...snapshots].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.start === prev.start && curr.end === prev.end) {
      blocked.push(`Duplicate edit region detected at offset ${curr.start}`);
    } else if (curr.start < prev.end) {
      blocked.push(`Overlapping edit regions detected at offsets ${prev.start} and ${curr.start}`);
    }
  }

  if (blocked.length > 0) {
    return { text, applied, blocked };
  }

  const byDesc = [...snapshots].sort((a, b) => b.start - a.start);
  let result = text;
  for (const snapshot of byDesc) {
    result = result.slice(0, snapshot.start) + snapshot.replacement + result.slice(snapshot.end);
  }

  applied.push(...snapshots.sort((a, b) => a.start - b.start).map((snapshot) => snapshot.decision));

  return { text: result, applied, blocked };
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

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function buildApplyFingerprint(
  ctx: RuntimeContext,
  completion: Extract<ReviseCompletionCertificationResult, { ok: true }>,
  applied: RuntimeDecision[],
): string {
  const decisions = applied
    .map((decision) => ({
      id: decision.id,
      opportunityId: decision.opportunity_id,
      decision: decision.decision,
      selectedOption: decision.selected_option,
      replacement: decision.decision === "custom" ? decision.custom_text ?? "" : decision.selected_text ?? "",
      sourceExcerpt: decision.source_excerpt ?? "",
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return createHash("sha256")
    .update(JSON.stringify({
      manuscriptId: ctx.manuscriptId,
      evaluationJobId: ctx.evaluationJobId,
      sourceVersionId: ctx.sourceVersionId,
      completionCertificationHash: completion.record.certification_hash,
      decisions,
    }))
    .digest("hex");
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

  const skippedDecisionIds = ctx.decisions.filter((decision) => !isCopyPasteExecutableDecision(ctx, decision)).map((d) => d.id);
  const metadata = {
    applied_count: result.applied.length,
    copy_paste_repair_count: ctx.queueSummary.copyPasteCount,
    strategy_card_count: ctx.queueSummary.strategyCount,
    withheld_blocked_count: ctx.queueSummary.withheldBlockedCount,
    revision_completion_artifact_id: completionArtifactId,
    ...completionMetadata(completion),
  };
  const applyFingerprint = buildApplyFingerprint(ctx, completion, result.applied);

  const { data, error } = await ctx.supabase.rpc("apply_final_review_once", {
    p_user_id: ctx.userId,
    p_manuscript_id: ctx.manuscriptId,
    p_evaluation_job_id: ctx.evaluationJobId,
    p_source_version_id: ctx.sourceVersionId,
    p_apply_fingerprint: applyFingerprint,
    p_raw_text: result.text,
    p_word_count: countWords(result.text),
    p_applied_decision_ids: result.applied.map((decision) => decision.id),
    p_skipped_decision_ids: skippedDecisionIds,
    p_metadata: metadata,
  });

  if (error) throw new Error(`Final Review Apply failed: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.revised_version_id) throw new Error("Final Review Apply did not return a revised version.");

  return {
    ok: true,
    revisedVersionId: row.revised_version_id as string,
    appliedCount: result.applied.length,
    reusedExistingVersion: row.reused_existing_version === true,
  };
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
