import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import type { ReportContent as CanonicalReportContent, Credibility } from "@/lib/evaluation/report-types";

/**
 * Gate A5: Canonical artifact type for the report.
 * IMPORTANT: Keep this aligned with your single source of truth enum (e.g., ARTIFACT_TYPES.ONE_PAGE_SUMMARY).
 */
const ARTIFACT_TYPE = "one_page_summary" as const;

/**
 * Ensure this route is always dynamic (per-user auth + per-job authorization).
 * Prevents accidental caching across users.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReportContent = {
  summary?: string;
  overall_score?: number | string;
  chunk_count?: number | string;
  processed_count?: number | string;
  generated_at?: string;
  credibility?: Credibility; // Gate A6: credibility metadata
};

type ArtifactRow = {
  job_id: string;
  artifact_type: string;
  artifact_version: number | string | null;
  content: unknown;
  created_at: string | null;
  updated_at: string | null;
  source_hash: string | null;
  source_phase: string | null;
};

function safeString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  return undefined;
}

function safeNumberLike(v: unknown): number | string | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return undefined;
    // Preserve non-numeric strings (e.g., "N/A") while still allowing numeric strings.
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : trimmed;
  }
  return undefined;
}

function coerceReportContent(raw: unknown): ReportContent {
  if (!raw || typeof raw !== "object") return {};

  const obj = raw as Record<string, unknown>;

  // Gate A6: Safely coerce credibility metadata if present
  let credibility: Credibility | undefined;
  if (obj.credibility && typeof obj.credibility === "object") {
    const cred = obj.credibility as Record<string, unknown>;
    credibility = {
      rubricBreakdown: Array.isArray(cred.rubricBreakdown) ? cred.rubricBreakdown : [],
      confidence: typeof cred.confidence === "number" ? cred.confidence : 0,
      evidenceCount: typeof cred.evidenceCount === "number" ? cred.evidenceCount : 0,
      coverageRatio: typeof cred.coverageRatio === "number" ? cred.coverageRatio : 0,
      varianceStability: typeof cred.varianceStability === "number" ? cred.varianceStability : 0,
      modelVersion: typeof cred.modelVersion === "string" ? cred.modelVersion : "unknown",
    };
  }

  return {
    summary: safeString(obj.summary),
    overall_score: safeNumberLike(obj.overall_score),
    chunk_count: safeNumberLike(obj.chunk_count),
    processed_count: safeNumberLike(obj.processed_count),
    generated_at: safeString(obj.generated_at),
    credibility, // Gate A6: credibility metadata
  };
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso; // fall back to raw
  return d.toLocaleString();
}

export default async function ReportPage({
  params,
}: {
  params: { jobId: string };
}) {
  const { jobId } = params;

  const supabase = await createClient();

  /**
   * ---------------------------------------------------------------------------
   * 1) Require authenticated user
   * ---------------------------------------------------------------------------
   */
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  /**
   * ---------------------------------------------------------------------------
   * 2) Verify ownership of the job
   *    - Gate A5 requirement: report must enforce ownership
   *    - Mask non-owners with 404 to prevent leakage
   * ---------------------------------------------------------------------------
   */
  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, user_id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    // Avoid dumping full error detail in logs by default (can be noisy/leaky in prod).
    console.error("ReportPage job lookup failed:", {
      code: jobError.code,
      message: jobError.message,
    });
    notFound();
  }

  if (!job || job.user_id !== user.id) {
    notFound();
  }

  /**
   * ---------------------------------------------------------------------------
   * 3) Load canonical artifact (SOURCE OF TRUTH)
   *    Report Authority Lock:
   *    - Reads ONLY from evaluation_artifacts
   *    - Never recomputes
   *
   * Scalability notes:
   *  - Filtered by job_id + artifact_type (should be indexed/unique)
   *  - Ordered by updated_at desc + limit(1) to be resilient if duplicates ever occur
   * ---------------------------------------------------------------------------
   */
  const { data: artifact, error: artifactError } = await supabase
    .from("evaluation_artifacts")
    .select(
      `
        job_id,
        artifact_type,
        artifact_version,
        content,
        created_at,
        updated_at,
        source_hash,
        source_phase
      `
    )
    .eq("job_id", jobId)
    .eq("artifact_type", ARTIFACT_TYPE)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ArtifactRow>();

  if (artifactError) {
    console.error("ReportPage artifact load failed:", {
      code: artifactError.code,
      message: artifactError.message,
    });

    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Report</h1>
        <p className="mt-4 text-red-600">
          Unable to load report for job {jobId}.
        </p>
      </main>
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * 4) Artifact not yet generated (use job status for clearer UX)
   * ---------------------------------------------------------------------------
   */
  if (!artifact) {
    const status = typeof job.status === "string" ? job.status : "unknown";
    const isRunning = status === "queued" || status === "running";
    const isFailed = status === "failed";

    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Report</h1>

        {isRunning ? (
          <>
            <p className="mt-4">No report available yet for job {jobId}.</p>
            <p className="text-sm text-gray-500">
              Job status: {status}. If the job is still running, refresh in a
              moment.
            </p>
          </>
        ) : isFailed ? (
          <>
            <p className="mt-4 text-red-600">
              This evaluation did not complete successfully.
            </p>
            <p className="text-sm text-gray-500">
              Job status: {status}. If this persists, rerun the job or contact
              support.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4">No report available yet for job {jobId}.</p>
            <p className="text-sm text-gray-500">Job status: {status}.</p>
          </>
        )}
      </main>
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * 5) Typed artifact content (defensive parsing)
   * ---------------------------------------------------------------------------
   */
  const content = coerceReportContent(artifact.content);

  /**
   * ---------------------------------------------------------------------------
   * 6) Render authoritative persisted report
   * ---------------------------------------------------------------------------
   */
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Evaluation Report</h1>

      <p className="text-sm text-gray-500">Job: {artifact.job_id}</p>
      <p className="text-sm text-gray-500">
        Updated: {formatDateTime(artifact.updated_at)}
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="mt-2">{content.summary ?? "(no summary available)"}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Overall Score</h2>
        <p className="mt-2 text-3xl font-bold">
          {content.overall_score ?? "--"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Processing Details</h2>
        <ul className="mt-2 list-disc pl-6">
          <li>Chunks: {content.chunk_count ?? "--"}</li>
          <li>Processed: {content.processed_count ?? "--"}</li>
          <li>Generated: {content.generated_at ?? "--"}</li>
        </ul>
      </section>

      {/* Gate A6: Credibility metadata rendering */}
      {content.credibility && (
        <>
          <section className="mt-6">
            <h2 className="text-xl font-semibold">Score Explanation</h2>
            <ul className="mt-2 list-disc pl-6">
              {content.credibility.rubricBreakdown.map((axis, i) => (
                <li key={i}>
                  <strong>{axis.label}:</strong>{" "}
                  {axis.score !== null ? axis.score.toFixed(1) : "N/A"} -{" "}
                  {axis.explanation}
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-xl font-semibold">Confidence & Provenance</h2>
            <ul className="mt-2 list-disc pl-6">
              <li>
                Confidence:{" "}
                {(content.credibility.confidence * 100).toFixed(1)}%
              </li>
              <li>Evidence Count: {content.credibility.evidenceCount}</li>
              <li>
                Coverage: {(content.credibility.coverageRatio * 100).toFixed(1)}
                %
              </li>
              <li>
                Variance Stability:{" "}
                {(content.credibility.varianceStability * 100).toFixed(1)}%
              </li>
              <li>Model: {content.credibility.modelVersion}</li>
            </ul>
          </section>
        </>
      )}

      {/* Optional credibility anchors (keep hidden until you want them visible)
      <section className="mt-6">
        <h2 className="text-xl font-semibold">Provenance</h2>
        <ul className="mt-2 list-disc pl-6 text-sm text-gray-500">
          <li>Artifact Type: {artifact.artifact_type}</li>
          <li>Version: {artifact.artifact_version ?? "--"}</li>
          <li>Source Phase: {artifact.source_phase ?? "--"}</li>
          <li>Source Hash: {artifact.source_hash ?? "--"}</li>
        </ul>
      </section>
      */}
    </main>
  );
}
