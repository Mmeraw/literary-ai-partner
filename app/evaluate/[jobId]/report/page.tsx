import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";

const ARTIFACT_TYPE = "one_page_summary";

type ReportContent = {
  summary?: string;
  overall_score?: number | string;
  chunk_count?: number | string;
  processed_count?: number | string;
  generated_at?: string;
};

export default async function ReportPage({
  params,
}: {
  params: { jobId: string };
}) {
  const { jobId } = params;

  const supabase = await createClient();

  /**
   * ---------------------------------------------------------------------------
   * 1. Require authenticated user
   * ---------------------------------------------------------------------------
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  /**
   * ---------------------------------------------------------------------------
   * 2. Verify ownership of the job
   *    (Gate A5 requirement: report must enforce ownership)
   * ---------------------------------------------------------------------------
   */
  const { data: job, error: jobError } = await supabase
    .from("evaluation_jobs")
    .select("id, user_id, status")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    console.error("ReportPage job lookup failed:", jobError);
    notFound();
  }

  if (!job || job.user_id !== user.id) {
    // Prevent information leakage
    notFound();
  }

  /**
   * ---------------------------------------------------------------------------
   * 3. Load canonical artifact (SOURCE OF TRUTH)
   *    Report Authority Lock:
   *    - Reads ONLY from evaluation_artifacts
   *    - Never recomputes
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
    .maybeSingle();

  if (artifactError) {
    console.error("ReportPage artifact load failed:", artifactError);

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
   * 4. Artifact not yet generated
   * ---------------------------------------------------------------------------
   */
  if (!artifact) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Report</h1>
        <p className="mt-4">No report available yet for job {jobId}.</p>
        <p className="text-sm text-gray-500">
          If the job is still running, refresh in a moment.
        </p>
      </main>
    );
  }

  /**
   * ---------------------------------------------------------------------------
   * 5. Typed artifact content
   * ---------------------------------------------------------------------------
   */
  const content: ReportContent =
    (artifact.content as ReportContent | null) ?? {};

  /**
   * ---------------------------------------------------------------------------
   * 6. Render authoritative persisted report
   * ---------------------------------------------------------------------------
   */
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Evaluation Report</h1>

      <p className="text-sm text-gray-500">Job: {artifact.job_id}</p>
      <p className="text-sm text-gray-500">
        Updated: {artifact.updated_at}
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="mt-2">
          {content.summary ?? "(no summary available)"}
        </p>
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
    </main>
  );
}
