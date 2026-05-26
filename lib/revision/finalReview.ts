import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export type FinalReviewDecision = {
  id: string;
  opportunityId: string;
  title: string;
  decision: "accepted_a" | "accepted_b" | "accepted_c" | "custom" | "keep_original" | "reject" | "deferred";
  selectedOption: "A" | "B" | "C" | null;
  customText: string | null;
  createdAt: string;
  highlightTone: "system" | "custom" | "kept" | "rejected" | "deferred";
};

export type FinalReviewPayload = {
  ok: boolean;
  error: string | null;
  manuscriptId: string | null;
  evaluationJobId: string | null;
  manuscriptTitle: string;
  sourceVersionId: string | null;
  sourceText: string;
  previewParagraphs: string[];
  decisions: FinalReviewDecision[];
  acceptedCount: number;
  customCount: number;
  keptCount: number;
  rejectedCount: number;
  deferredCount: number;
  unresolvedMustCount: number;
};

function emptyPayload(error: string | null): FinalReviewPayload {
  return {
    ok: !error,
    error,
    manuscriptId: null,
    evaluationJobId: null,
    manuscriptTitle: "Final Review",
    sourceVersionId: null,
    sourceText: "",
    previewParagraphs: [],
    decisions: [],
    acceptedCount: 0,
    customCount: 0,
    keptCount: 0,
    rejectedCount: 0,
    deferredCount: 0,
    unresolvedMustCount: 0,
  };
}

function toneForDecision(decision: FinalReviewDecision["decision"]): FinalReviewDecision["highlightTone"] {
  if (decision === "custom") return "custom";
  if (decision === "keep_original") return "kept";
  if (decision === "reject") return "rejected";
  if (decision === "deferred") return "deferred";
  return "system";
}

function splitPreviewParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 18);
}

export async function getFinalReviewPayload(input: {
  manuscriptId?: string;
  evaluationJobId?: string;
}): Promise<FinalReviewPayload> {
  if (!input.manuscriptId || !input.evaluationJobId) {
    return emptyPayload("Open Final Review from a completed Revise Workbench so RevisionGrade knows which manuscript and evaluation to review.");
  }

  const user = await getAuthenticatedUser();
  if (!user) return emptyPayload("Please sign in to open Final Review.");

  const manuscriptId = Number(input.manuscriptId);
  if (!Number.isInteger(manuscriptId)) return emptyPayload("Invalid manuscript id.");

  const supabase = createAdminClient();

  const { data: manuscript, error: manuscriptError } = await supabase
    .from("manuscripts")
    .select("id, title, user_id")
    .eq("id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (manuscriptError) return emptyPayload(manuscriptError.message);
  if (!manuscript) return emptyPayload("Manuscript not found in your workspace.");

  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, status, manuscript_id, manuscript_version_id")
    .eq("id", input.evaluationJobId)
    .eq("manuscript_id", manuscriptId)
    .maybeSingle();

  if (jobError) return emptyPayload(jobError.message);
  if (!job) return emptyPayload("Evaluation job not found for this manuscript.");
  if (job.status !== "complete") return emptyPayload("This evaluation is not complete yet. Final Review can open after Revise has a completed evaluation source.");
  if (!job.manuscript_version_id) return emptyPayload("This evaluation is missing its manuscript version link.");

  const { data: version } = await supabase
    .from("manuscript_versions")
    .select("id, raw_text")
    .eq("id", job.manuscript_version_id)
    .maybeSingle();

  const { data: ledgerRows, error: ledgerError } = await supabase
    .from("revision_ledger_decisions")
    .select("id, opportunity_id, opportunity_title, decision, selected_option, custom_text, created_at, is_undo")
    .eq("user_id", user.id)
    .eq("manuscript_id", manuscriptId)
    .eq("evaluation_job_id", input.evaluationJobId)
    .eq("is_undo", false)
    .order("created_at", { ascending: false });

  if (ledgerError) return emptyPayload(ledgerError.message);

  const latestByOpportunity = new Map<string, any>();
  for (const row of ledgerRows ?? []) {
    if (!latestByOpportunity.has(row.opportunity_id)) latestByOpportunity.set(row.opportunity_id, row);
  }

  const decisions: FinalReviewDecision[] = [...latestByOpportunity.values()].map((row) => {
    const decision = row.decision as FinalReviewDecision["decision"];
    return {
      id: row.id,
      opportunityId: row.opportunity_id,
      title: row.opportunity_title,
      decision,
      selectedOption: row.selected_option,
      customText: row.custom_text,
      createdAt: row.created_at,
      highlightTone: toneForDecision(decision),
    };
  });

  const acceptedCount = decisions.filter((d) => d.decision.startsWith("accepted_")).length;
  const customCount = decisions.filter((d) => d.decision === "custom").length;
  const keptCount = decisions.filter((d) => d.decision === "keep_original").length;
  const rejectedCount = decisions.filter((d) => d.decision === "reject").length;
  const deferredCount = decisions.filter((d) => d.decision === "deferred").length;

  return {
    ok: true,
    error: null,
    manuscriptId: input.manuscriptId,
    evaluationJobId: input.evaluationJobId,
    manuscriptTitle: manuscript.title ?? "Untitled Manuscript",
    sourceVersionId: job.manuscript_version_id,
    sourceText: version?.raw_text ?? "",
    previewParagraphs: splitPreviewParagraphs(version?.raw_text ?? ""),
    decisions,
    acceptedCount,
    customCount,
    keptCount,
    rejectedCount,
    deferredCount,
    unresolvedMustCount: deferredCount,
  };
}
