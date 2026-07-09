export const dynamic = "force-dynamic";

import Link from "next/link";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV2 from "@/components/revision/ReviseCockpitClientWorkflowV2";
import TrustedPathWorkbenchButton from "@/components/revision/TrustedPathWorkbenchButton";
import ResetQueueButton from "@/components/revision/ResetQueueButton";
import HardResetRestartButton from "@/components/evaluation/HardResetRestartButton";
import { redirect } from "next/navigation";
import { resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";
import SupportAccessToggle from "@/components/reports/SupportAccessToggle";
import ReportConcernForm from "@/components/reports/ReportConcernForm";
import styles from "./workbench-v2.module.css";

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

  const finalReviewHref = manuscriptId && evaluationJobId
    ? `/workbench/final-review?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}`
    : "/workbench/final-review";

  return (
    <div className={`workbench-v2-route ${styles.route}`}>
      <div className="workbench-v2-action-rail fixed right-4 top-[82px] z-50 flex flex-row flex-nowrap items-center gap-2">
        <ResetQueueButton evaluationJobId={evaluationJobId ?? null} />
        {evaluationJobId && <HardResetRestartButton jobId={evaluationJobId} compact label="Restart Eval" />}
        <TrustedPathWorkbenchButton manuscriptId={manuscriptId ?? null} evaluationJobId={evaluationJobId ?? null} disabled={!payload.ok} />
        <Link href={finalReviewHref} className="workbench-v2-final-review-link flex h-10 items-center justify-center rounded border border-[#C8A96E] bg-[#1C160E] px-4 text-center text-[12px] font-bold leading-[13px] text-[#F3E3C3] shadow-lg hover:bg-[#2A2115] whitespace-nowrap">
          Final Review / Apply &amp; Export
        </Link>
      </div>
      <ReviseCockpitClientWorkflowV2 payload={payload} />
      {evaluationJobId && (
        <div className="mx-auto mt-8 max-w-3xl space-y-3 px-4 pb-8">
          <SupportAccessToggle jobId={evaluationJobId} scope="revision_data" />
          <ReportConcernForm jobId={evaluationJobId} page="revise-workbench" />
        </div>
      )}
    </div>
  );
}
