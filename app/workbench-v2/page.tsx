export const dynamic = "force-dynamic";

import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV2 from "@/components/revision/ReviseCockpitClientWorkflowV2";
import { redirect } from "next/navigation";
import { resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";
import SupportAccessToggle from "@/components/reports/SupportAccessToggle";
import ReportConcernForm from "@/components/reports/ReportConcernForm";

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

  return (
    <>
      <ReviseCockpitClientWorkflowV2 payload={payload} />
      {evaluationJobId && (
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
          <SupportAccessToggle jobId={evaluationJobId} scope="revision_data" />
          <ReportConcernForm jobId={evaluationJobId} page="revise-workbench" />
        </div>
      )}
    </>
  );
}
