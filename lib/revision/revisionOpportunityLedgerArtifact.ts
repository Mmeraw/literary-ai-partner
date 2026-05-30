import crypto from "crypto";
import type { WorkbenchQueuePayload } from "@/lib/revision/workbenchQueue";
import { createAdminClient } from "@/lib/supabase/admin";

export type RevisionOpportunityLedgerV1 = {
  schema_version: "revision_opportunity_ledger_v1";
  generated_at: string;
  job_id: string;
  manuscript_id: string;
  manuscript_title: string;
  queue_summary: {
    ok: boolean;
    error: string | null;
    totals: WorkbenchQueuePayload["totals"];
    scopes: WorkbenchQueuePayload["scopes"];
    synthesis: WorkbenchQueuePayload["synthesis"];
  };
  opportunities: WorkbenchQueuePayload["opportunities"];
};

export function buildRevisionOpportunityLedger(input: {
  jobId: string;
  manuscriptId: string;
  payload: WorkbenchQueuePayload;
}): RevisionOpportunityLedgerV1 {
  return {
    schema_version: "revision_opportunity_ledger_v1",
    generated_at: new Date().toISOString(),
    job_id: input.jobId,
    manuscript_id: input.manuscriptId,
    manuscript_title: input.payload.manuscriptTitle,
    queue_summary: {
      ok: input.payload.ok,
      error: input.payload.error,
      totals: input.payload.totals,
      scopes: input.payload.scopes,
      synthesis: input.payload.synthesis,
    },
    opportunities: input.payload.opportunities,
  };
}

function hashLedger(ledger: RevisionOpportunityLedgerV1): string {
  return crypto.createHash("sha256").update(JSON.stringify(ledger), "utf8").digest("hex");
}

export async function persistRevisionOpportunityLedger(input: {
  jobId: string;
  manuscriptId: number;
  ledger: RevisionOpportunityLedgerV1;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("evaluation_artifacts").upsert(
    {
      job_id: input.jobId,
      manuscript_id: input.manuscriptId,
      artifact_type: "revision_opportunity_ledger_v1",
      artifact_version: "revision_opportunity_ledger_v1",
      source_hash: hashLedger(input.ledger),
      content: input.ledger,
    },
    { onConflict: "job_id,artifact_type", ignoreDuplicates: false },
  );

  if (error) {
    throw new Error(`Failed to persist revision opportunity ledger: ${error.message}`);
  }
}
