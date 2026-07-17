export const dynamic = "force-dynamic";

import { getWorkbenchQueue, resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";
import { redirect } from "next/navigation";
import Link from "next/link";
import ReviseQueueBrowser from "@/components/revision/ReviseQueueBrowser";

function QueueMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-[60vh] bg-[#0E0B07] px-6 py-16 text-[#F3E3C3]">
      <div className="mx-auto max-w-3xl rounded-xl border border-[#C8A96E]/35 bg-[#171109] p-8 shadow-xl">
        <p className="font-rg-mono text-xs font-bold uppercase tracking-[0.18em] text-[#C8A96E]">Revise Queue</p>
        <h1 className="mt-3 font-rg-serif text-4xl text-[#FFF3D6]">{title}</h1>
        <p className="mt-4 text-base leading-7 text-[#F3E3C3]">{body}</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/evaluate" className="rounded-lg border border-[#C8A96E] bg-[#C8A96E] px-4 py-2 text-sm font-bold text-[#0D0A05]">
            View evaluations
          </Link>
          <Link href="/manuscripts" className="rounded-lg border border-[#F3E3C3]/40 bg-transparent px-4 py-2 text-sm font-bold text-[#FFF3D6] hover:bg-white/5">
            View manuscripts
          </Link>
        </div>
      </div>
    </main>
  );
}

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

    return (
      <QueueMessage
        title="No eligible evaluation was found."
        body="Completed evaluations should appear here once their revision opportunities are available. This page will no longer fail silently or render as an empty black screen."
      />
    );
  }

  try {
    const payload = await getWorkbenchQueue({ manuscriptId, evaluationJobId });

    if (!payload.ok) {
      return <QueueMessage title="The revision queue could not be loaded." body={payload.error ?? "Please open the evaluation and try again."} />;
    }

    return (
      <main className="min-h-screen bg-[#0E0B07] text-[#F3E3C3]">
        <ReviseQueueBrowser payload={payload} />
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected revision queue error.";
    return <QueueMessage title="The revision queue could not be loaded." body={message} />;
  }
}
