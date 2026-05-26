import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseWorkbenchClient from "@/components/revision/ReviseWorkbenchClient";

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

  const payload = await getWorkbenchQueue({ manuscriptId, evaluationJobId });

  return <ReviseWorkbenchClient payload={payload} />;
}
