import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClient from "@/components/revision/ReviseCockpitClient";
import { buildRevisionOpportunityLedger, persistRevisionOpportunityLedger } from "@/lib/revision/revisionOpportunityLedgerArtifact";

export default async function WorkbenchV2Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const manuscriptId = Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw;
  const evaluationJobId = Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw;
  const payload = await getWorkbenchQueue({ manuscriptId, evaluationJobId });
  const manuscriptNumericId = Number(manuscriptId);
  if (payload.ok && manuscriptId && evaluationJobId && Number.isInteger(manuscriptNumericId)) {
    try {
      await persistRevisionOpportunityLedger({
        jobId: evaluationJobId,
        manuscriptId: manuscriptNumericId,
        ledger: buildRevisionOpportunityLedger({ jobId: evaluationJobId, manuscriptId, payload }),
      });
    } catch (error) {
      console.error("Failed to persist revision_opportunity_ledger_v1", error);
    }
  }
  return <ReviseCockpitClient payload={payload} />;
}
