import AgentReadinessWorkbenchClient, {
  type AgentReadinessManuscriptOption,
} from "./AgentReadinessWorkbenchClient";
import { getDashboardEvaluations } from "@/lib/dashboard/getDashboardEvaluations";

export const dynamic = "force-dynamic";

type PageSearchParams = {
  manuscriptId?: string | string[];
  evaluationJobId?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AgentReadinessPage({
  searchParams,
}: {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const requestedManuscriptId = firstParam(resolvedSearchParams.manuscriptId);
  const requestedEvaluationJobId = firstParam(resolvedSearchParams.evaluationJobId);
  const { rows, error } = await getDashboardEvaluations({ limit: 50 });

  const completedRows = rows
    .filter((row) => row.status !== "running" && row.status !== "failed")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const manuscripts: AgentReadinessManuscriptOption[] = completedRows.map((row) => ({
    manuscriptId: row.manuscriptId,
    evaluationJobId: row.jobId,
    title: row.manuscriptTitle,
    latestEvaluationStatus: "Complete",
    readinessScore: row.readinessScore,
    overallScore: row.overallScore,
    packageStatus: "Not Started",
    reportHref: row.reportHref,
    evaluatedAt: row.createdAt,
  }));

  return (
    <div className="agent-readiness-route">
      <AgentReadinessWorkbenchClient
        manuscripts={manuscripts}
        requestedManuscriptId={requestedManuscriptId}
        requestedEvaluationJobId={requestedEvaluationJobId}
        loadError={error ? error.message : null}
      />
    </div>
  );
}
