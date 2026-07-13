/**
 * TrustedPath — canonical auto-apply for copy-paste-ready repairs.
 *
 * One source of truth for:
 *   - /api/revise/trusted-path (legacy workbench)
 *   - /api/revision-ledger/trusted-path (workbench-v2)
 *   - previewTrustedPath()
 *
 * Contract:
 * - Only workbench-classified `copy_paste_rewrite` cards with
 *   `trustedPathStatus === 'eligible'` are accepted.
 * - If repair cross-check is enabled, the finding must also have an `approve`
 *   verdict for Option A.
 * - Already-decided opportunities are skipped, not overwritten.
 * - Each ledger entry carries the actual selected replacement text so Final
 *   Review can apply it without guessing.
 * - Returns a `finalReviewUrl` so every UI surface links to the same next step.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isTrustedPathEligible, isRepairCrossCheckEnabled } from "./repairCrossCheck";
import { syncRevisionLedgerDecisions, type SyncRevisionLedgerEntryInput } from "./ledger";
import { getWorkbenchQueue, type WorkbenchOpportunity } from "./workbenchQueue";
import { getRenderableCandidateText } from "./reviseCardContract";
import { deriveReviseEligibilityLabel } from "@/lib/evaluation/modeGate";
import {
  hasExplicitRevisionModeContract,
  modeContractForMetadata,
  modeContractToConfirmedMode,
  resolveRevisionModeContract,
} from "./modeContract";
import { extractGenreExpectationMetadataFromEvaluationPayload } from "@/lib/evaluation/genreExpectationProfiles";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrustedPathSummary = {
  ok: boolean;
  error: string | null;
  appliedCount: number;
  skippedCount: number;
  alreadyDecidedCount: number;
  appliedFindingIds: string[];
  skippedReasons: Record<string, number>;
  finalReviewUrl: string | null;
};

export type TrustedPathPreview = {
  eligible: number;
  alreadyDecided: number;
  total: number;
};

type ApprovedCrossCheck = {
  finding_id: string;
  option_key: string;
  verdict: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emptyResult(error: string | null): TrustedPathSummary {
  return {
    ok: !error,
    error,
    appliedCount: 0,
    skippedCount: 0,
    alreadyDecidedCount: 0,
    appliedFindingIds: [],
    skippedReasons: {},
    finalReviewUrl: null,
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function compareText(value: string | null | undefined): string {
  return normalize(value).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function sourceTextOf(item: WorkbenchOpportunity): string {
  const text = `${item.quoteHighlight ?? ""}${item.quoteRest ?? ""}`.trim();
  if (!text || /no excerpt available/i.test(text)) return "";
  return text;
}

function candidateRepeatsSourceForInsertion(item: WorkbenchOpportunity, text: string): boolean {
  if (
    item.revisionOperation !== "insert_before_selected_passage" &&
    item.revisionOperation !== "insert_after_selected_passage"
  ) {
    return false;
  }

  const source = compareText(sourceTextOf(item));
  const candidate = compareText(text);
  if (!source || !candidate) return false;

  const lead = source.split(/\s+/).slice(0, 6).join(" ");
  return lead.length >= 8 && candidate.startsWith(lead);
}

function getTrustedPathCandidateText(item: WorkbenchOpportunity): string {
  if (item.readiness !== "ready_for_revise") return "";
  if (item.cardType !== "copy_paste_rewrite" || item.trustedPathStatus !== "eligible") return "";

  const option = item.options.find((entry) => entry.key === "A");
  if (!option) return "";

  const candidate = getRenderableCandidateText({
    candidateText: option.candidateText || option.text,
    issueStatement: item.issueStatement,
  });

  if (!candidate || candidateRepeatsSourceForInsertion(item, candidate)) return "";
  return candidate;
}

function criterionOf(item: WorkbenchOpportunity): string {
  return item.criterion || item.crumb.split(" · ")[0]?.trim() || "General";
}

function buildFinalReviewUrl(manuscriptId: string | number, evaluationJobId: string): string {
  return `/workbench/final-review?${new URLSearchParams({
    manuscriptId: String(manuscriptId),
    evaluationJobId: String(evaluationJobId),
  }).toString()}`;
}

function buildEntry(
  item: WorkbenchOpportunity,
  selectedText: string,
  crossCheckEnabled: boolean,
): SyncRevisionLedgerEntryInput {
  return {
    localId: `trusted-path:${item.id}:accepted_a`,
    opportunityId: item.id,
    opportunityTitle: item.title,
    decision: "accepted_a",
    selectedOption: "A",
    selectedText,
    customText: null,
    sourceExcerpt: sourceTextOf(item) || null,
    sourceLocation: item.anchor || item.meta || null,
    clientCreatedAt: new Date().toISOString(),
    isUndo: false,
    undoneLocalId: null,
    metadata: {
      source: "trusted_path",
      trustedPath: true,
      crossCheckVerdict: crossCheckEnabled ? "approve" : null,
      revisionOperation: item.revisionOperation,
      criterion: criterionOf(item),
      severity: item.severity,
      scope: item.scope,
      cardType: item.cardType,
      trustedPathStatus: item.trustedPathStatus,
      executabilityReasons: item.executabilityReasons ?? [],
    },
  };
}

function incrementReason(reasons: Record<string, number>, reason: string): Record<string, number> {
  return { ...reasons, [reason]: (reasons[reason] ?? 0) + 1 };
}

async function loadApprovedCrossCheckIds(
  supabase: ReturnType<typeof createAdminClient>,
  evaluationJobId: string,
): Promise<Set<string>> {
  const { data: approvedChecks, error: checksError } = await supabase
    .from("revision_repair_cross_checks")
    .select("finding_id, option_key, verdict")
    .eq("evaluation_job_id", evaluationJobId)
    .eq("option_key", "A")
    .eq("verdict", "approve");

  if (checksError) throw new Error(`Failed to load repair cross-checks: ${checksError.message}`);

  return new Set(
    (approvedChecks ?? [])
      .filter((check: ApprovedCrossCheck) => isTrustedPathEligible(check.verdict as any))
      .map((check: ApprovedCrossCheck) => check.finding_id),
  );
}

async function loadAlreadyDecidedOpportunityIds(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  manuscriptId: number,
  evaluationJobId: string,
): Promise<Set<string>> {
  const { data: existingDecisions, error: ledgerError } = await supabase
    .from("revision_ledger_decisions")
    .select("opportunity_id")
    .eq("user_id", userId)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", evaluationJobId)
    .eq("is_undo", false);

  if (ledgerError) throw new Error(`Failed to load existing ledger decisions: ${ledgerError.message}`);

  const alreadyDecided = new Set<string>();
  for (const row of existingDecisions ?? []) {
    if (typeof row.opportunity_id === "string") {
      alreadyDecided.add(row.opportunity_id);
    }
  }
  return alreadyDecided;
}

async function loadModeAndEligibility(
  supabase: ReturnType<typeof createAdminClient>,
  manuscriptId: number,
  evaluationJobId: string,
): Promise<{
  job: any;
  modeContract: any;
  genreExpectationContext: any;
  eligibility: string;
}> {
  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id, policy_family, voice_preservation_level")
    .eq("id", evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) throw new Error(jobError.message);
  if (!job) throw new Error("Evaluation job not found for this manuscript");
  if (job.status !== "complete") throw new Error("Evaluation is not complete yet");

  const { data: evaluationArtifact } = await supabase
    .from("evaluation_artifacts")
    .select("content")
    .eq("job_id", evaluationJobId)
    .eq("artifact_type", "evaluation_result_v2")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const modeContract = resolveRevisionModeContract({
    evaluationPayload: evaluationArtifact?.content,
    job,
  });

  if (!hasExplicitRevisionModeContract(modeContract)) {
    throw new Error("TrustedPath is blocked: evaluation mode contract is unavailable.");
  }

  const genreExpectationContext = extractGenreExpectationMetadataFromEvaluationPayload(
    evaluationArtifact?.content,
  );

  if (!genreExpectationContext) {
    throw new Error("TrustedPath is blocked: genre expectation contract is unavailable.");
  }

  const eligibility = deriveReviseEligibilityLabel({
    confirmedMode: modeContractToConfirmedMode(modeContract),
  });

  if (eligibility !== "Eligible for Trustpath") {
    throw new Error(
      `TrustedPath is blocked for ${modeContract.evaluation_mode} / ${modeContract.voice_preservation}. Use manual Revise review.`,
    );
  }

  return { job, modeContract, genreExpectationContext, eligibility };
}

async function loadOwnership(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  manuscriptId: number,
): Promise<void> {
  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, user_id")
    .eq("id", manuscriptId)
    .eq("user_id", userId)
    .maybeSingle();

  if (manuscriptError) throw new Error(manuscriptError.message);
  if (!manuscript) throw new Error("Manuscript not found in your workspace");
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function applyTrustedPath(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
}): Promise<TrustedPathSummary> {
  const user = await getAuthenticatedUser();
  if (!user) return emptyResult("Not authenticated");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) return emptyResult("Invalid manuscript id");

  const supabase = createAdminClient();

  try {
    await loadOwnership(supabase, user.id, manuscriptId);
    const { modeContract } = await loadModeAndEligibility(supabase, manuscriptId, input.evaluationJobId);

    const queuePayload = await getWorkbenchQueue({
      user,
      manuscriptId: String(manuscriptId),
      evaluationJobId: input.evaluationJobId,
    });
    if (!queuePayload.ok) return emptyResult(queuePayload.error ?? "Revise Queue unavailable.");

    const alreadyDecided = await loadAlreadyDecidedOpportunityIds(
      supabase,
      user.id,
      manuscriptId,
      input.evaluationJobId,
    );

    const crossCheckEnabled = isRepairCrossCheckEnabled();
    const approvedFindingIds = crossCheckEnabled
      ? await loadApprovedCrossCheckIds(supabase, input.evaluationJobId)
      : new Set<string>();

    const entries: SyncRevisionLedgerEntryInput[] = [];
    const appliedFindingIds: string[] = [];
    const skippedReasons: Record<string, number> = {};
    let alreadyDecidedCount = 0;

    for (const item of queuePayload.opportunities) {
      if (item.cardType !== "copy_paste_rewrite" || item.trustedPathStatus !== "eligible") {
        skippedReasons["not_trusted_path_eligible"] = (skippedReasons["not_trusted_path_eligible"] ?? 0) + 1;
        continue;
      }

      if (crossCheckEnabled && !approvedFindingIds.has(item.id)) {
        skippedReasons["cross_check_not_approved"] = (skippedReasons["cross_check_not_approved"] ?? 0) + 1;
        continue;
      }

      if (alreadyDecided.has(item.id)) {
        alreadyDecidedCount += 1;
        continue;
      }

      const selectedText = getTrustedPathCandidateText(item);
      if (!selectedText) {
        skippedReasons["candidate_not_renderable"] = (skippedReasons["candidate_not_renderable"] ?? 0) + 1;
        continue;
      }

      const entry = buildEntry(item, selectedText, crossCheckEnabled);
      entry.metadata = {
        ...entry.metadata,
        modeContract: modeContractForMetadata(modeContract),
      };
      entries.push(entry);
      appliedFindingIds.push(item.id);
    }

    if (entries.length === 0) {
      return {
        ...emptyResult(null),
        skippedCount: Object.values(skippedReasons).reduce((a, b) => a + b, 0),
        alreadyDecidedCount,
        skippedReasons,
        finalReviewUrl: buildFinalReviewUrl(manuscriptId, input.evaluationJobId),
      };
    }

    await syncRevisionLedgerDecisions({
      manuscriptId,
      evaluationJobId: input.evaluationJobId,
      entries,
      user,
    });

    return {
      ok: true,
      error: null,
      appliedCount: entries.length,
      skippedCount: Object.values(skippedReasons).reduce((a, b) => a + b, 0),
      alreadyDecidedCount,
      appliedFindingIds,
      skippedReasons,
      finalReviewUrl: buildFinalReviewUrl(manuscriptId, input.evaluationJobId),
    };
  } catch (err) {
    return emptyResult(err instanceof Error ? err.message : String(err));
  }
}

export async function previewTrustedPath(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
}): Promise<TrustedPathPreview> {
  const user = await getAuthenticatedUser();
  if (!user) return { eligible: 0, alreadyDecided: 0, total: 0 };

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) return { eligible: 0, alreadyDecided: 0, total: 0 };

  const supabase = createAdminClient();

  try {
    await loadOwnership(supabase, user.id, manuscriptId);
    await loadModeAndEligibility(supabase, manuscriptId, input.evaluationJobId);

    const queuePayload = await getWorkbenchQueue({
      user,
      manuscriptId: String(manuscriptId),
      evaluationJobId: input.evaluationJobId,
    });
    if (!queuePayload.ok) return { eligible: 0, alreadyDecided: 0, total: 0 };

    const alreadyDecided = await loadAlreadyDecidedOpportunityIds(
      supabase,
      user.id,
      manuscriptId,
      input.evaluationJobId,
    );

    const crossCheckEnabled = isRepairCrossCheckEnabled();
    const approvedFindingIds = crossCheckEnabled
      ? await loadApprovedCrossCheckIds(supabase, input.evaluationJobId)
      : new Set<string>();

    const eligibleOpportunities = queuePayload.opportunities.filter((item) => {
      if (item.cardType !== "copy_paste_rewrite" || item.trustedPathStatus !== "eligible") return false;
      if (crossCheckEnabled && !approvedFindingIds.has(item.id)) return false;
      return true;
    });

    const total = eligibleOpportunities.length;
    const alreadyDecidedCount = eligibleOpportunities.filter((item) => alreadyDecided.has(item.id)).length;
    const eligible = total - alreadyDecidedCount;

    return { eligible, alreadyDecided: alreadyDecidedCount, total };
  } catch {
    return { eligible: 0, alreadyDecided: 0, total: 0 };
  }
}
