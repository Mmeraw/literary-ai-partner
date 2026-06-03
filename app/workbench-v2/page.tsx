export const dynamic = "force-dynamic";

import Link from "next/link";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV2 from "@/components/revision/ReviseCockpitClientWorkflowV2";
import TrustedPathWorkbenchButton from "@/components/revision/TrustedPathWorkbenchButton";
import ResetQueueButton from "@/components/revision/ResetQueueButton";
import { buildRevisionOpportunityLedger, persistRevisionOpportunityLedger } from "@/lib/revision/revisionOpportunityLedgerArtifact";
import { redirect } from "next/navigation";
import { resolveWorkbenchRouteTargetForUser } from "@/lib/revision/workbenchQueue";
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

  const finalReviewHref = manuscriptId && evaluationJobId
    ? `/workbench/final-review?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}`
    : "/workbench/final-review";

  return (
    <div className={`workbench-v2-route ${styles.route}`}>
      <Link href={finalReviewHref} className="workbench-v2-final-review-link fixed right-6 top-[78px] z-50 flex h-10 w-[216px] items-center justify-center rounded border border-[#C8A96E] bg-[#1C160E] px-4 text-center text-[12px] font-bold leading-[13px] text-[#F3E3C3] shadow-lg hover:bg-[#2A2115]">
        Final Review / Apply & Export
      </Link>
      <div className="workbench-v2-reset-queue fixed right-[640px] top-[78px] z-50">
        <ResetQueueButton evaluationJobId={evaluationJobId ?? null} />
      </div>
      <TrustedPathWorkbenchButton manuscriptId={manuscriptId ?? null} evaluationJobId={evaluationJobId ?? null} disabled={!payload.ok} />
      <ReviseCockpitClientWorkflowV2 payload={payload} />
    </div>
  );
}
