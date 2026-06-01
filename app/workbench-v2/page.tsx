import Link from "next/link";
import { getWorkbenchQueue } from "@/lib/revision/workbenchQueue";
import ReviseCockpitClientWorkflowV2 from "@/components/revision/ReviseCockpitClientWorkflowV2";
import TrustedPathWorkbenchButton from "@/components/revision/TrustedPathWorkbenchButton";
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

  const finalReviewHref = manuscriptId && evaluationJobId
    ? `/workbench/final-review?${new URLSearchParams({ manuscriptId, evaluationJobId }).toString()}`
    : "/workbench/final-review";

  return (
    <div className="workbench-v2-route">
      <style>{`
        .workbench-v2-route main { top: 72px !important; padding-top: 0.75rem !important; }
        .workbench-v2-route main > div > header { min-height: 3.25rem !important; padding-top: 0.55rem !important; padding-bottom: 0.55rem !important; }
        .workbench-v2-route main > div > header > div:last-child { padding-right: 360px !important; gap: 0.7rem !important; flex-wrap: nowrap !important; align-items: center !important; }
        .workbench-v2-route .workbench-v2-trusted-path, .workbench-v2-route .workbench-v2-final-review-link { top: 85px !important; }
        .workbench-v2-route .workbench-v2-trusted-path { right: 420px !important; left: auto !important; transform: none !important; }
        .workbench-v2-route .workbench-v2-final-review-link { right: 1.5rem !important; min-width: 280px !important; text-align: center !important; }
        @media (max-width: 1500px) {
          .workbench-v2-route main > div > header > div:last-child { padding-right: 330px !important; gap: 0.55rem !important; }
          .workbench-v2-route .workbench-v2-trusted-path { right: 382px !important; }
        }
      `}</style>
      <Link href={finalReviewHref} className="workbench-v2-final-review-link fixed right-6 top-[85px] z-50 rounded border border-[#C8A96E] bg-[#1C160E] px-4 py-2.5 text-xs font-semibold text-[#F3E3C3] shadow-lg hover:bg-[#2A2115]">
        Final Review / Apply & Export
      </Link>
      <TrustedPathWorkbenchButton manuscriptId={manuscriptId ?? null} evaluationJobId={evaluationJobId ?? null} disabled={!payload.ok} />
      <ReviseCockpitClientWorkflowV2 payload={payload} />
    </div>
  );
}
