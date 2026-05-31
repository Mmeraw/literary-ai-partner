import { redirect } from "next/navigation";
import { resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";

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

  if (manuscriptId && evaluationJobId) {
    redirect(`/workbench-v2?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}`);
  }

  const resolved = await resolveWorkbenchRouteTargetForUser();
  if (resolved) {
    redirect(`/workbench-v2?${new URLSearchParams(resolved).toString()}`);
  }

  redirect("/workbench-v2");
}
