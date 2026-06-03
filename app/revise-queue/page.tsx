export const dynamic = "force-dynamic";

import { getWorkbenchQueue, resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";
import { redirect } from "next/navigation";
import ReviseQueueBrowser from "@/components/revision/ReviseQueueBrowser";

export default async function ReviseQueuePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const manuscriptId = Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw;
  const evaluationJobId = Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw;

  if (!manuscriptId || !evaluationJobId) {
    const resolved = await resolveWorkbenchRouteTargetForUser();
    if (resolved) {
      redirect(`/revise-queue?${new URLSearchParams(resolved).toString()}`);
    }
  }

  const payload = await getWorkbenchQueue({ manuscriptId, evaluationJobId });

  return (
    <div className="min-h-screen bg-[#0E0B07] text-[#F3E3C3]">
      <ReviseQueueBrowser payload={payload} />
    </div>
  );
}
