import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientChoiceLedger from "@/components/revision/ReviseCockpitClientChoiceLedger";
import { buildRevisionOpportunityLedger, persistRevisionOpportunityLedger } from "@/lib/revision/revisionOpportunityLedgerArtifact";
import { redirect } from "next/navigation";
import { resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";

export default async function WorkbenchV2Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const manuscriptId = Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw;
  const evaluationJobId = Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw;

  if (!manuscriptId || !evaluationJobId) {
    const resolved = await resolveWorkbenchRouteTargetForUser();
    if (resolved) {
      redirect(`/workbench-v2?${new URLSearchParams(resolved).toString()}`);
    }
  }

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
  return <ReviseCockpitClientChoiceLedger payload={payload} />;
}
