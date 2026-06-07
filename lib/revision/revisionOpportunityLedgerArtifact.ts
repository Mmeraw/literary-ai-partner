import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "./workbenchQueue";
import { createHash } from "crypto";

export const REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE = "revision_opportunity_ledger_v1" as const;

export type RevisionOpportunityLedgerV1 = {
  job_id: string;
  evaluation_project_id: string | null;
  manuscript_id: number;
  manuscript_version_hash: string;
  artifact_id: string;
  artifact_type: typeof REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE;
  artifact_version: string;
  source_hash: string;
  generated_at: string;
  opportunities: Array<{
    opportunity_id: string;
    criterion: string;
    severity: "must" | "should" | "could";
    rationale: string;
    evidence_anchor: string;
    manuscript_coordinates: string;
    provenance: string;
    confidence: "low" | "medium" | "high";
    decision_state: "open";
  }>;
};

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function confidenceBand(value: string): "low" | "medium" | "high" {
  const normalized = value.toLowerCase();
  const percent = Number(normalized.match(/(\d+)%/)?.[1]);
  if (Number.isFinite(percent)) {
    if (percent >= 80) return "high";
    if (percent < 50) return "low";
  }
  if (normalized.includes("high")) return "high";
  if (normalized.includes("low")) return "low";
  return "medium";
}

function canonicalOpportunity(opportunity: WorkbenchOpportunity, index: number): RevisionOpportunityLedgerV1["opportunities"][number] {
  return {
    opportunity_id: opportunity.id || `workbench:${index + 1}`,
    criterion: opportunity.criterion || "GENERAL",
    severity: opportunity.severity,
    rationale: opportunity.fixDirection || opportunity.issueStatement || opportunity.title || "Revision opportunity requires review.",
    evidence_anchor: `${opportunity.quoteHighlight ?? ""}${opportunity.quoteRest ?? ""}`.trim() || opportunity.anchor || "No excerpt available",
    manuscript_coordinates: opportunity.anchor || opportunity.meta || `workbench:${index + 1}`,
    provenance: opportunity.source || "workbench_queue_synthesis",
    confidence: confidenceBand(opportunity.confidence || "medium"),
    decision_state: "open",
  };
}

export function buildRevisionOpportunityLedger(input: {
  jobId: string;
  manuscriptId: string;
  payload: WorkbenchQueuePayload;
}): RevisionOpportunityLedgerV1 {
  const manuscriptId = Number(input.manuscriptId);
  const opportunities = input.payload.opportunities.map(canonicalOpportunity);
  const artifactId = `${REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE}:${input.jobId.slice(0, 8)}`;
  return {
    job_id: input.jobId,
    evaluation_project_id: null,
    manuscript_id: Number.isFinite(manuscriptId) ? manuscriptId : 0,
    manuscript_version_hash: `manuscript_${input.manuscriptId}_${input.jobId}`,
    artifact_id: artifactId,
    artifact_type: REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE,
    artifact_version: "v1",
    source_hash: stableHash({ jobId: input.jobId, manuscriptId: input.manuscriptId, opportunities }),
    generated_at: new Date().toISOString(),
    opportunities,
  };
}

export async function persistRevisionOpportunityLedger(input: {
  jobId: string;
  manuscriptId: number;
  ledger: RevisionOpportunityLedgerV1;
}): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("evaluation_artifacts")
    .upsert(
      {
        job_id: input.jobId,
        manuscript_id: input.manuscriptId,
        artifact_type: REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE,
        artifact_version: "v1",
        source_phase: "revise_queue_synthesis",
        content: input.ledger,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "job_id,artifact_type", ignoreDuplicates: false },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to persist revision_opportunity_ledger_v1: ${error.message}`);
  }

  return data?.id ?? null;
}
