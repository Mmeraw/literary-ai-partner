import { redirect } from "next/navigation";
import { resolveWorkbenchRouteTarget } from "@/lib/revision/workbenchQueue";

export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const manuscriptId = Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw;
  const evaluationJobId = Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw;
  const routeTarget = await resolveWorkbenchRouteTarget({ manuscriptId, evaluationJobId });

  if (routeTarget) {
    redirect(`/workbench-v2?manuscriptId=${encodeURIComponent(routeTarget.manuscriptId)}&evaluationJobId=${encodeURIComponent(routeTarget.evaluationJobId)}`);
  }

  redirect('/workbench-v2');
}
