import AgentReadinessClient, {
  type AgentReadinessManuscriptOption,
} from "./AgentReadinessClient";
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

function packageStatusForManuscript(): AgentReadinessManuscriptOption["packageStatus"] {
  // Placeholder until package persistence exists. The page now carries manuscript context
  // through the workflow, and persisted draft/approval state can replace this seam.
  return "Not Started";
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

  const manuscripts: AgentReadinessManuscriptOption[] = rows
    .filter((row) => row.status !== "running" && row.status !== "failed")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((row) => ({
      manuscriptId: row.manuscriptId,
      evaluationJobId: row.jobId,
      title: row.manuscriptTitle,
      latestEvaluationStatus: "Complete",
      readinessScore: row.readinessScore,
      overallScore: row.overallScore,
      packageStatus: packageStatusForManuscript(),
      reportHref: row.reportHref,
      evaluatedAt: row.createdAt,
    }));

  return (
    <AgentReadinessClient
      manuscripts={manuscripts}
      requestedManuscriptId={requestedManuscriptId}
      requestedEvaluationJobId={requestedEvaluationJobId}
      loadError={error ? error.message : null}
    />
  );
}
