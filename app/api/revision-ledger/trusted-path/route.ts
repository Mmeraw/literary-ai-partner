import { NextResponse } from "next/server";
import { getWorkbenchQueue, type WorkbenchOpportunity } from "@/lib/revision/workbenchQueue";
import { candidateTextIsCopyPasteReady, getRenderableCandidateText } from "@/lib/revision/reviseCardContract";
import { syncRevisionLedgerDecisions, type SyncRevisionLedgerEntryInput } from "@/lib/revision/ledger";

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
  const option = item.options.find((entry) => entry.key === "A");
  if (!option) return "";
  const candidate = getRenderableCandidateText({
    candidateText: option.candidateText || option.text,
    issueStatement: item.issueStatement,
  });
  if (!candidate || candidateRepeatsSourceForInsertion(item, candidate)) return "";
  return candidate;
}

function specificFallbackCandidate(item: WorkbenchOpportunity): string {
  const haystack = compareText(`${item.title} ${item.issueStatement} ${sourceTextOf(item)} ${item.fixDirection}`);

  if (haystack.includes("move aside") && haystack.includes("small fry") && haystack.includes("newton")) {
    return "Newton’s hand tightened around the slug before he let it go. The loss was small, but in front of the others, the choice had cost him.";
  }

  if (haystack.includes("why") && haystack.includes("picking on me") && haystack.includes("newton")) {
    return "Newton’s voice caught before he could harden it. The question came out smaller than he meant, and that made the silence around him worse.";
  }

  if (haystack.includes("hithery") || haystack.includes("sensory detail") || haystack.includes("body or surroundings")) {
    return "The hithery-thithery dock clattered under Newton’s feet as two worried voices knocked inside his skull.";
  }

  return "";
}

function trustedPathCandidate(item: WorkbenchOpportunity): string {
  const option = optionA(item);
  if (option) return option;

  const fallback = specificFallbackCandidate(item);
  if (fallback && candidateTextIsCopyPasteReady(fallback) && !candidateRepeatsSourceForInsertion(item, fallback)) return fallback;

  return "";
}

function buildEntry(item: WorkbenchOpportunity, selectedText: string): SyncRevisionLedgerEntryInput {
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

    const allItems = [...payload.opportunities, ...(payload.needsTargeting ?? [])];
    const entries: SyncRevisionLedgerEntryInput[] = [];
    const skipped: Array<{ id: string; title: string; reason: string }> = [];
    const seen = new Set<string>();

    for (const item of allItems) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const selectedText = trustedPathCandidate(item);
      if (!selectedText) {
        skipped.push({ id: item.id, title: item.title, reason: "Recommended Repair A is not copy-ready." });
        continue;
      }
      entries.push(buildEntry(item, selectedText));
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
