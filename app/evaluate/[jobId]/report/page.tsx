import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const ARTIFACT_TYPE = "one_page_summary";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: artifact, error } = await supabase
    .from("evaluation_artifacts")
    .select(
      "job_id, artifact_type, artifact_version, content, created_at, updated_at, source_hash, source_phase"
    )
    .eq("job_id", jobId)
    .eq("artifact_type", ARTIFACT_TYPE)
    .maybeSingle();

  if (error) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Report</h1>
        <p className="mt-4 text-red-600">
          Unable to load report for job {jobId}.
        </p>
      </main>
    );
  }

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

  const c = artifact.content as Record<string, unknown> ?? {};

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Evaluation Report</h1>
      <p className="text-sm text-gray-500">Job: {artifact.job_id}</p>
      <p className="text-sm text-gray-500">
        Updated: {artifact.updated_at}
      </p>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Summary</h2>
        <p className="mt-2">{String(c.summary ?? "(no summary available)")}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Overall Score</h2>
        <p className="mt-2 text-3xl font-bold">
          {String(c.overall_score ?? "--")}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">Processing Details</h2>
        <ul className="mt-2 list-disc pl-6">
          <li>Chunks: {String(c.chunk_count ?? "--")}</li>
          <li>Processed: {String(c.processed_count ?? "--")}</li>
          <li>Generated: {String(c.generated_at ?? "--")}</li>
        </ul>
      </section>
    </main>
  );
}
