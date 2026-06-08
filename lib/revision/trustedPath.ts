/**
 * TrustedPath™ — Apply All Approved
 *
 * Queries all cross-check-approved Option A repairs for an evaluation job
 * and auto-accepts them into the revision ledger. Only findings with an
 * `approve` verdict from the Perplexity cross-check verifier are eligible.
 *
 * Designed for the time-pressed author who does not want to review hundreds
 * of individually verified repairs one by one.
 *
 * Contract:
 * - Only `approve` verdicts are auto-applied (isTrustedPathEligible gate).
 * - Original manuscript is never mutated — ledger entries are created.
 * - Flagged, rejected, unavailable, and pending findings remain in the
 *   workbench for manual review.
 * - Returns a summary of what was applied vs what remains.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isTrustedPathEligible, type CrossCheckVerdict } from "./repairCrossCheck";
import type { SyncRevisionLedgerEntryInput } from "./ledger";
import { syncRevisionLedgerDecisions } from "./ledger";
import { ensureOperationalRevisionFindings } from './operationalQueueBuilder';
import { deriveReviseEligibilityLabel } from "@/lib/evaluation/modeGate";
import {
  hasExplicitRevisionModeContract,
  modeContractForMetadata,
  modeContractToConfirmedMode,
  resolveRevisionModeContract,
} from "./modeContract";
import { extractGenreExpectationMetadataFromEvaluationPayload } from "@/lib/evaluation/genreExpectationProfiles";
import { getWorkbenchQueue } from "./workbenchQueue";

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrustedPathSummary = {
  ok: boolean;
  error: string | null;
  appliedCount: number;
  skippedCount: number;
  alreadyDecidedCount: number;
  appliedFindingIds: string[];
  skippedReasons: Record<string, number>;
};

type ApprovedCrossCheck = {
  finding_id: string;
  option_key: string;
  verdict: string;
  evaluation_job_id: string;
};

// ─── Core ───────────────────────────────────────────────────────────────────

function emptyResult(error: string | null): TrustedPathSummary {
  return {
    ok: !error,
    error,
    appliedCount: 0,
    skippedCount: 0,
    alreadyDecidedCount: 0,
    appliedFindingIds: [],
    skippedReasons: {},
  };
}

/**
 * Run TrustedPath: auto-accept all cross-check-approved Option A repairs
 * into the revision ledger for a given manuscript + evaluation.
 */
export async function applyTrustedPath(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
}): Promise<TrustedPathSummary> {
  const user = await getAuthenticatedUser();
  if (!user) return emptyResult("Not authenticated");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) return emptyResult("Invalid manuscript id");

  const supabase = createAdminClient();

  // Verify manuscript ownership
  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, user_id")
    .eq("id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (manuscriptError) return emptyResult(manuscriptError.message);
  if (!manuscript) return emptyResult("Manuscript not found in your workspace");

  // Verify evaluation job
  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id, policy_family, voice_preservation_level")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) return emptyResult(jobError.message);
  if (!job) return emptyResult("Evaluation job not found for this manuscript");
  if (job.status !== "complete") return emptyResult("Evaluation is not complete yet");

  const { data: evaluationArtifact } = await supabase
    .from("evaluation_artifacts")
    .select("content")
    .eq("job_id", input.evaluationJobId)
    .eq("artifact_type", "evaluation_result_v2")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const modeContract = resolveRevisionModeContract({
    evaluationPayload: evaluationArtifact?.content,
    job,
  });
  if (!hasExplicitRevisionModeContract(modeContract)) {
    return emptyResult("TrustedPath™ is blocked: evaluation mode contract is unavailable.");
  }
  const genreExpectationContext = extractGenreExpectationMetadataFromEvaluationPayload(evaluationArtifact?.content);
  if (!genreExpectationContext) {
    return emptyResult("TrustedPath™ is blocked: genre expectation contract is unavailable.");
  }
  const eligibility = deriveReviseEligibilityLabel({
    confirmedMode: modeContractToConfirmedMode(modeContract),
  });
  if (eligibility !== "Eligible for Trustpath") {
    return emptyResult(`TrustedPath™ is blocked for ${modeContract.evaluation_mode} / ${modeContract.voice_preservation}. Use manual Revise review.`);
  }

  const queuePayload = await getWorkbenchQueue({
    manuscriptId: String(manuscriptId),
    evaluationJobId: input.evaluationJobId,
  });
  if (!queuePayload.ok) return emptyResult(queuePayload.error ?? "Revise Queue unavailable.");
  const supportedOpportunityIds = new Set(queuePayload.opportunities.map((opportunity) => opportunity.id));

  await ensureOperationalRevisionFindings(
    input.evaluationJobId,
    (job.manuscript_version_id as string | null) ?? '',
  );

  // Fetch all cross-check results with approve verdict for this evaluation
  const { data: approvedChecks, error: checksError } = await supabase
    .from("revision_repair_cross_checks")
    .select("finding_id, option_key, verdict, evaluation_job_id")
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("option_key", "A")
    .eq("verdict", "approve");

  if (checksError) return emptyResult(checksError.message);

  const eligible = (approvedChecks ?? []).filter(
    (check: ApprovedCrossCheck) => isTrustedPathEligible(check.verdict as CrossCheckVerdict),
  );

  if (eligible.length === 0) {
    return {
      ...emptyResult(null),
      skippedReasons: { no_approved_verdicts: 1 },
    };
  }

  // Fetch existing ledger decisions to avoid re-applying
  const { data: existingDecisions, error: ledgerError } = await supabase
    .from("revision_ledger_decisions")
    .select("opportunity_id, decision, is_undo")
    .eq("user_id", user.id)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("is_undo", false);

  if (ledgerError) return emptyResult(ledgerError.message);

  // Build a set of opportunity IDs that already have a non-pending decision
  const alreadyDecided = new Set<string>();
  for (const row of existingDecisions ?? []) {
    alreadyDecided.add(row.opportunity_id);
  }

  // Fetch finding details so we can populate the ledger entry titles
  const eligibleFindingIds = eligible.map((c: ApprovedCrossCheck) => c.finding_id);

  const { data: findings, error: findingsError } = await supabase
    .from("diagnostic_findings")
    .select("id, criterion_key, diagnosis, location_ref")
    .in("id", eligibleFindingIds);

  if (findingsError) return emptyResult(findingsError.message);

  const findingMap = new Map<string, { criterion_key: string; diagnosis: string; location_ref: string | null }>();
  for (const f of findings ?? []) {
    findingMap.set(f.id, f);
  }

  // Build ledger entries for eligible findings not yet decided
  const entries: SyncRevisionLedgerEntryInput[] = [];
  const appliedFindingIds: string[] = [];
  const skippedReasons: Record<string, number> = {};
  let alreadyDecidedCount = 0;

  for (const check of eligible) {
    const findingId = check.finding_id;

    if (!supportedOpportunityIds.has(findingId)) {
      skippedReasons["unsupported_or_withheld"] = (skippedReasons["unsupported_or_withheld"] ?? 0) + 1;
      continue;
    }

    if (alreadyDecided.has(findingId)) {
      alreadyDecidedCount++;
      continue;
    }

    const finding = findingMap.get(findingId);
    if (!finding) {
      skippedReasons["finding_not_found"] = (skippedReasons["finding_not_found"] ?? 0) + 1;
      continue;
    }

    const title = finding.diagnosis.length > 150
      ? `${finding.diagnosis.slice(0, 147).trim()}…`
      : finding.diagnosis;

    entries.push({
      localId: `trustedpath-${Date.now()}-${findingId.slice(0, 8)}`,
      opportunityId: findingId,
      opportunityTitle: title,
      decision: "accepted_a",
      selectedOption: "A",
      customText: null,
      selectedText: null,
      clientCreatedAt: new Date().toISOString(),
      isUndo: false,
      undoneLocalId: null,
      metadata: {
        source: "trustedpath-auto-apply",
        crossCheckVerdict: "approve",
        modeContract: modeContractForMetadata(modeContract),
        genreExpectationContext,
      },
    });

    appliedFindingIds.push(findingId);
  }

  const skippedCount = Object.values(skippedReasons).reduce((a, b) => a + b, 0);

  if (entries.length === 0) {
    return {
      ok: true,
      error: null,
      appliedCount: 0,
      skippedCount,
      alreadyDecidedCount,
      appliedFindingIds: [],
      skippedReasons,
    };
  }

  // Sync to the revision ledger
  try {
    await syncRevisionLedgerDecisions({
      manuscriptId: String(manuscriptId),
      evaluationJobId: input.evaluationJobId,
      entries,
    });
  } catch (err) {
    return emptyResult(
      `Failed to sync TrustedPath decisions: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    ok: true,
    error: null,
    appliedCount: entries.length,
    skippedCount,
    alreadyDecidedCount,
    appliedFindingIds,
    skippedReasons,
  };
}

/**
 * Preview how many findings are eligible for TrustedPath without applying.
 * Used by the UI to show the count on the button.
 */
export async function previewTrustedPath(input: {
  manuscriptId: string | number;
  evaluationJobId: string;
}): Promise<{ eligible: number; alreadyDecided: number; total: number }> {
  const user = await getAuthenticatedUser();
  if (!user) return { eligible: 0, alreadyDecided: 0, total: 0 };

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) return { eligible: 0, alreadyDecided: 0, total: 0 };

  const supabase = createAdminClient();

  const { data: job } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, policy_family, voice_preservation_level")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  const { data: evaluationArtifact } = await supabase
    .from("evaluation_artifacts")
    .select("content")
    .eq("job_id", input.evaluationJobId)
    .eq("artifact_type", "evaluation_result_v2")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const modeContract = resolveRevisionModeContract({
    evaluationPayload: evaluationArtifact?.content,
    job,
  });
  if (!hasExplicitRevisionModeContract(modeContract)) return { eligible: 0, alreadyDecided: 0, total: 0 };
  if (!extractGenreExpectationMetadataFromEvaluationPayload(evaluationArtifact?.content)) {
    return { eligible: 0, alreadyDecided: 0, total: 0 };
  }
  const eligibility = deriveReviseEligibilityLabel({
    confirmedMode: modeContractToConfirmedMode(modeContract),
  });
  if (eligibility !== "Eligible for Trustpath") return { eligible: 0, alreadyDecided: 0, total: 0 };

  const queuePayload = await getWorkbenchQueue({
    manuscriptId: String(manuscriptId),
    evaluationJobId: input.evaluationJobId,
  });
  if (!queuePayload.ok) return { eligible: 0, alreadyDecided: 0, total: 0 };
  const supportedOpportunityIds = new Set(queuePayload.opportunities.map((opportunity) => opportunity.id));

  const { data: approvedChecks } = await supabase
    .from("revision_repair_cross_checks")
    .select("finding_id")
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("option_key", "A")
    .eq("verdict", "approve");

  const supportedApprovedChecks = (approvedChecks ?? []).filter((check: { finding_id: string }) => supportedOpportunityIds.has(check.finding_id));
  const total = supportedApprovedChecks.length;
  if (total === 0) return { eligible: 0, alreadyDecided: 0, total: 0 };

  const findingIds = supportedApprovedChecks.map((c: { finding_id: string }) => c.finding_id);

  const { data: existingDecisions } = await supabase
    .from("revision_ledger_decisions")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("is_undo", false)
    .in("opportunity_id", findingIds);

  const alreadyDecided = existingDecisions?.length ?? 0;

  return {
    eligible: total - alreadyDecided,
    alreadyDecided,
    total,
  };
}
