import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkbenchOpportunity, WorkbenchQueuePayload } from "./workbenchQueue";

export const REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE = "revision_opportunity_ledger_v1" as const;

export type RevisionOpportunityLedgerV1 = {
  schema_version: typeof REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE;
  job_id: string;
  manuscript_id: string;
  generated_at: string;
  source: "workbench_queue_synthesis";
  opportunities: WorkbenchOpportunity[];
  totals: WorkbenchQueuePayload["totals"];
  scopes: WorkbenchQueuePayload["scopes"];
  criteria: WorkbenchQueuePayload["criteria"];
  synthesis: WorkbenchQueuePayload["synthesis"];
};

export function buildRevisionOpportunityLedger(input: {
  jobId: string;
  manuscriptId: string;
  payload: WorkbenchQueuePayload;
}): RevisionOpportunityLedgerV1 {
  return {
    schema_version: REVISION_OPPORTUNITY_LEDGER_ARTIFACT_TYPE,
    job_id: input.jobId,
    manuscript_id: input.manuscriptId,
    generated_at: new Date().toISOString(),
    source: "workbench_queue_synthesis",
    opportunities: input.payload.opportunities,
    totals: input.payload.totals,
    scopes: input.payload.scopes,
    criteria: input.payload.criteria,
    synthesis: input.payload.synthesis,
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
