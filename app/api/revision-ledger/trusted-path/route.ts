import { NextResponse } from "next/server";
import { getWorkbenchQueue, type WorkbenchOpportunity } from "@/lib/revision/workbenchQueue";
import { getRenderableCandidateText } from "@/lib/revision/reviseCardContract";
import { syncRevisionLedgerDecisions, type SyncRevisionLedgerEntryInput } from "@/lib/revision/ledger";
import { deriveReviseEligibilityLabel } from "@/lib/evaluation/modeGate";
import {
  hasExplicitRevisionModeContract,
  modeContractForMetadata,
  modeContractToConfirmedMode,
  type RevisionModeContract,
} from "@/lib/revision/modeContract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function criterionOf(item: WorkbenchOpportunity): string {
  return item.criterion || item.crumb.split(" · ")[0]?.trim() || "General";
}

function candidateRepeatsSourceForInsertion(item: WorkbenchOpportunity, text: string): boolean {
  if (item.revisionOperation !== "insert_before_selected_passage" && item.revisionOperation !== "insert_after_selected_passage") return false;

  const source = compareText(sourceTextOf(item));
  const candidate = compareText(text);
  if (!source || !candidate) return false;

  const lead = source.split(/\s+/).slice(0, 6).join(" ");
  return lead.length >= 8 && candidate.startsWith(lead);
}

function optionA(item: WorkbenchOpportunity): string {
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

function buildEntry(item: WorkbenchOpportunity, selectedText: string, modeContract: RevisionModeContract): SyncRevisionLedgerEntryInput {
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
      revisionOperation: item.revisionOperation,
      criterion: criterionOf(item),
      severity: item.severity,
      scope: item.scope,
      cardType: item.cardType,
      trustedPathStatus: item.trustedPathStatus,
      executabilityReasons: item.executabilityReasons ?? [],
      modeContract: modeContractForMetadata(modeContract),
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const manuscriptId = body?.manuscriptId;
    const evaluationJobId = body?.evaluationJobId;

    if (!manuscriptId) return NextResponse.json({ ok: false, error: "Missing manuscriptId" }, { status: 400 });
    if (!evaluationJobId) return NextResponse.json({ ok: false, error: "Missing evaluationJobId" }, { status: 400 });

    const payload = await getWorkbenchQueue({ manuscriptId: String(manuscriptId), evaluationJobId: String(evaluationJobId) });
    if (!payload.ok) return NextResponse.json({ ok: false, error: payload.error ?? "Revise Queue is unavailable." }, { status: 409 });
    if (!hasExplicitRevisionModeContract(payload.modeContract)) {
      return NextResponse.json({ ok: false, error: "TrustedPath™ is blocked: evaluation mode contract is unavailable." }, { status: 409 });
    }

    const eligibility = deriveReviseEligibilityLabel({
      confirmedMode: modeContractToConfirmedMode(payload.modeContract),
    });
    if (eligibility !== "Eligible for Trustpath") {
      return NextResponse.json({
        ok: false,
        error: `TrustedPath™ is blocked for ${payload.modeContract.evaluation_mode} / ${payload.modeContract.voice_preservation}. Use manual Revise review.`,
        modeContract: modeContractForMetadata(payload.modeContract),
      }, { status: 409 });
    }

    const allItems = [...payload.opportunities];
    const entries: SyncRevisionLedgerEntryInput[] = [];
    const skipped: Array<{ id: string; title: string; reason: string }> = [];
    const seen = new Set<string>();

    for (const item of allItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const selectedText = optionA(item);
      if (!selectedText) {
        skipped.push({ id: item.id, title: item.title, reason: "Recommended Repair A is not copy-ready." });
        continue;
      }
      entries.push(buildEntry(item, selectedText, payload.modeContract));
    }

    if (entries.length === 0) {
      return NextResponse.json({
        ok: false,
        error: "TrustedPath™ found no copy-ready Recommended Repair A items. Needs Targeting items require manual review.",
        appliedCount: 0,
        skippedCount: skipped.length,
        skipped,
      }, { status: 409 });
    }

    const synced = await syncRevisionLedgerDecisions({ manuscriptId, evaluationJobId, entries });

    return NextResponse.json({
      ok: true,
      appliedCount: entries.length,
      skippedCount: skipped.length,
      skipped,
      entries: synced,
      finalReviewUrl: `/workbench/final-review?${new URLSearchParams({ manuscriptId: String(manuscriptId), evaluationJobId: String(evaluationJobId) }).toString()}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Not authenticated" ? 401 : message.includes("not found") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
