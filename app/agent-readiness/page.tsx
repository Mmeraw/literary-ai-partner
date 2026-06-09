import AgentReadinessClient, {
  type AgentReadinessManuscriptOption,
} from "./AgentReadinessClient";
import { getDashboardEvaluations } from "@/lib/dashboard/getDashboardEvaluations";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PageSearchParams = {
  manuscriptId?: string | string[];
  evaluationJobId?: string | string[];
};

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const ALL_SECTIONS = ["query_letter", "synopsis", "pitch", "bio", "comparables", "unique"] as const;

async function getPackageStatuses(
  userId: string,
  manuscriptIds: string[],
): Promise<Map<string, AgentReadinessManuscriptOption["packageStatus"]>> {
  const result = new Map<string, AgentReadinessManuscriptOption["packageStatus"]>();
  if (manuscriptIds.length === 0) return result;

  const supabase = createAdminClient();
  const { data: sections } = await supabase
    .from("agent_readiness_sections")
    .select("manuscript_id, section_type, status")
    .eq("user_id", userId)
    .in("manuscript_id", manuscriptIds.map(Number).filter((n) => !Number.isNaN(n)));

  if (!sections || sections.length === 0) return result;

  const byManuscript = new Map<number, Array<{ section_type: string; status: string }>>();
  for (const s of sections as Array<{ manuscript_id: number; section_type: string; status: string }>) {
    const arr = byManuscript.get(s.manuscript_id) ?? [];
    arr.push({ section_type: s.section_type, status: s.status });
    byManuscript.set(s.manuscript_id, arr);
  }

  for (const [mid, secs] of byManuscript) {
    const allApproved = ALL_SECTIONS.every((t) =>
      secs.some((s) => s.section_type === t && s.status === "approved"),
    );
    if (allApproved) {
      result.set(String(mid), "Approved");
    } else {
      result.set(String(mid), "Draft");
    }
  }

  return result;
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
  const user = await getAuthenticatedUser();

  const completedRows = rows
    .filter((row) => row.status !== "running" && row.status !== "failed")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const manuscriptIds = [...new Set(completedRows.map((r) => r.manuscriptId))];
  const statuses = user
    ? await getPackageStatuses(user.id, manuscriptIds)
    : new Map<string, AgentReadinessManuscriptOption["packageStatus"]>();

  const manuscripts: AgentReadinessManuscriptOption[] = completedRows.map((row) => ({
    manuscriptId: row.manuscriptId,
    evaluationJobId: row.jobId,
    title: row.manuscriptTitle,
    latestEvaluationStatus: "Complete",
    readinessScore: row.readinessScore,
    overallScore: row.overallScore,
    packageStatus: statuses.get(row.manuscriptId) ?? "Not Started",
    reportHref: row.reportHref,
    evaluatedAt: row.createdAt,
  }));

  return (
    <div className="agent-readiness-route">
      <AgentReadinessClient
        manuscripts={manuscripts}
        requestedManuscriptId={requestedManuscriptId}
        requestedEvaluationJobId={requestedEvaluationJobId}
        loadError={error ? error.message : null}
      />
    </div>
  );
}
